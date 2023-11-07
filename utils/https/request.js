import https from 'https'

const request = async(url, options, data) => {

  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      const body = []
      res.on('data', (chunk) => body.push(chunk))
      res.on('end', () => {
        const resString = Buffer.concat(body).toString()

        if (res.statusCode < 200 || res.statusCode > 299) {
          reject(resString)
        } else {
          resolve(resString)
        }
      })
    })

    req.on('error', (err) => {
      console.log(err)
      reject(err)
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request time out'))
    })
    if (data) {
        req.write(JSON.stringify(data));
    }
    req.end()
  })
}

export default request
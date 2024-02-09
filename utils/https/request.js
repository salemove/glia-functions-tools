const request = async(url, options, data) => {
  const { method, headers } = options;
  const result = await fetch(url, {
    method: method,
    headers: headers,
    body: JSON.stringify(data)
  })
  const jsonResult = await result.json()
  return JSON.stringify(jsonResult)
}

export default request
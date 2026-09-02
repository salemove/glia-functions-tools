const request = async(url, options, data) => {

  const { method, headers } = options;
  return fetch(url, {
    method: method,
    headers: headers,
    body: JSON.stringify(data)
  })
}

export default request
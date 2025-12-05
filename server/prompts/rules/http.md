## HTTP (External APIs)

**Tools:** http_get, http_post

**Flow:**
1. http_get -> fetch data from external API
2. http_post -> send data to external API (requires confirmation)

**Examples:**
```
GET request:
  http_get({url: "https://api.example.com/data"})
  -> {status: 200, data: {...}}

POST request:
  http_post({
    url: "https://api.example.com/submit",
    body: {key: "value"},
    confirmed: true
  })
```

**Edge cases:**
- http_post requires confirmed:true
- Handle errors gracefully
- Respect rate limits on external APIs
- Include appropriate headers if needed

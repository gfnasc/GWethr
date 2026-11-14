// Qualquer escrita (envio da estação, aviso de chuva, login) limpa o cache de leitura desta instância.
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('request', (event) => {
    if (event.method !== 'GET' && event.method !== 'HEAD') clearReadCache()
  })
})

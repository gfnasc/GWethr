// Horários das atualizações, para os contadores do painel. Exige login ou token de leitura.
// Estimativas: a estação envia as médias de 5 min em lotes, logo que fecha cada quarto de hora,
// e a previsão de chuva é recalculada a cada envio; o METAR é conferido a cada envio e o
// aeroporto publica de hora em hora (ou antes, se o tempo mudar); Open-Meteo e TAF a cada 30 min.
// A consulta ao banco fica no cache de leitura (ver read-cache.ts); os horários são calculados agora.

const SEND_S = 900
const MODEL_S = 30 * 60

export default defineEventHandler(async (event) => {
  await requireReadAccess(event)
  const d = await cachedRead('sync', async () => {
    const deviceId = await defaultDeviceId()
    if (!deviceId) return null
    const [row] = (await useSql()`
      select last_seen_at, outdoor,
        (select max(issued_at) from rain_predictions where device_id = ${deviceId}) as last_rain,
        (select max(obs_at) from outdoor_obs where device_id = ${deviceId} and source = 'metar') as last_metar
      from devices where id = ${deviceId}`) as any[]
    return row
  })
  if (!d) throw createError({ statusCode: 404, message: 'nenhuma estação cadastrada' })
  const ms = (v: unknown) => (v ? new Date(v as string).getTime() : null)
  const now = Date.now()
  // Próximo envio (e próxima rodada de chuva): o próximo quarto de hora.
  const nextQuarter = Math.ceil((now - 60_000) / (SEND_S * 1000)) * SEND_S * 1000
  const lastRain = ms(d.last_rain)
  const lastMetar = ms(d.last_metar)
  const nextMetar = lastMetar ? Math.max(lastMetar + 3600_000, now) : null
  const modelAt = d.outdoor?.om_try ?? null
  const tafAt = d.outdoor?.taf?.at ?? null
  return {
    now,
    interval_s: SEND_S,
    station: { last: ms(d.last_seen_at), next: d.last_seen_at ? nextQuarter : null },
    rain: { last: lastRain, next: lastRain ? nextQuarter : null },
    metar: { last: lastMetar, next: nextMetar },
    model: { last: modelAt, next: modelAt ? modelAt + MODEL_S * 1000 : null },
    taf: { last: tafAt, next: tafAt ? tafAt + MODEL_S * 1000 : null },
  }
})

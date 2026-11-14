import type { H3Event } from 'h3'

// Cache das rotas de leitura do painel. A estação envia em lotes nos quartos de hora (firmware
// 0.16.0) e, entre um envio e outro, os dados não mudam: cada resposta fica na memória da
// função até logo depois do próximo envio. Assim o painel aberto (que atualiza a cada minuto) e
// os leitores como a Gspresso não acordam o banco a toda hora: o Neon gratuito dorme depois de
// 5 min parado e a cota é de horas acordado (estourou em 31/10 com envios a cada 5 min).
// Cada instância da função tem o seu cache; qualquer escrita (POST, como o envio) o limpa.
const SEND_MS = 15 * 60_000
const AFTER_SEND_MS = 90_000 // folga para o envio do quarto de hora chegar
const MAX_KEYS = 200
const store = new Map<string, { until: number; value: unknown }>()

// Vale até 90 s depois do próximo quarto de hora.
export function readCacheUntil(now = Date.now()): number {
  return (Math.floor((now - AFTER_SEND_MS) / SEND_MS) + 1) * SEND_MS + AFTER_SEND_MS
}

export async function cachedRead<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const hit = store.get(key)
  if (hit && hit.until > now) return hit.value as T
  const value = await fn()
  if (store.size >= MAX_KEYS) store.clear()
  store.set(key, { until: readCacheUntil(now), value })
  return value
}

export function clearReadCache() {
  store.clear()
}

// Rota de leitura: confere o acesso (sessão do painel ou token de leitor) e guarda a resposta
// pelo caminho com a query (cada intervalo de datas tem a sua).
export function defineReadHandler<T>(fn: (event: H3Event) => Promise<T>) {
  return defineEventHandler(async (event) => {
    await requireReadAccess(event)
    return cachedRead(event.path, () => fn(event))
  })
}

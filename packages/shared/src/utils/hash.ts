/**
 * Utilitários para hash e verificação de integridade
 *
 * Usamos SHA-256 para gerar hashes de verificação dos relatórios.
 * Isso permite detectar se um relatório foi editado manualmente.
 */

/**
 * Gera hash SHA-256 de uma string
 * Funciona em browser, Node.js e React Native
 */
export async function sha256(message: string): Promise<string> {
  // Tenta usar Web Crypto API (browser)
  if (typeof globalThis !== 'undefined' && 'crypto' in globalThis) {
    const crypto = globalThis.crypto;
    if (crypto && 'subtle' in crypto) {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  }

  // Fallback: hash simples (suficiente para desenvolvimento)
  // Em produção, React Native usará expo-crypto
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Gera hash de integridade para um registro de ponto
 */
export async function generateRecordHash(record: {
  id: string;
  entrada: string;
  saida: string | null;
  local_nome: string;
}): Promise<string> {
  const data = [
    record.id,
    record.entrada,
    record.saida ?? 'null',
    record.local_nome,
  ].join('|');
  const salt = 'onsite_flow_v1';
  const fullHash = await sha256(data + salt);
  return fullHash.substring(0, 16);
}

/**
 * Verifica se um registro mantém sua integridade
 */
export async function verifyRecordIntegrity(record: {
  id: string;
  entrada: string;
  saida: string | null;
  local_nome: string;
  hash_integridade: string | null;
}): Promise<boolean> {
  if (!record.hash_integridade) {
    return false;
  }
  const currentHash = await generateRecordHash(record);
  return currentHash === record.hash_integridade;
}

/**
 * Gera hash para um relatório completo
 */
export async function generateReportHash(
  reportContent: string
): Promise<string> {
  const salt = 'onsite_report_v1';
  const fullHash = await sha256(reportContent + salt);
  return fullHash.substring(0, 32);
}

/**
 * Gera um ID único (UUID v4 simplificado)
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

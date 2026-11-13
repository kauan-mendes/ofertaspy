import { createHmac, timingSafeEqual } from 'node:crypto';
export const TOTAL_CENTS = 990;
export const MBWAY_BASE_CENTS = 805;
export const TITLE = 'Validação académica — pagamento de teste real';
export function verifySignature(raw, timestamp, signature, secret, now = Date.now()) {
  if (!secret || !/^\d+$/.test(timestamp || '') || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = Buffer.from('sha256=' + createHmac('sha256', secret).update(timestamp + '.').update(raw).digest('hex'));
  const given = Buffer.from(signature || '');
  return given.length === expected.length && timingSafeEqual(given, expected);
}
export function validateCustomer(body) {
  if (!body || body.method !== 'mbway' || body.consent !== true) throw new Error('Seleciona o método e confirma que compreendes a cobrança real.');
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  if (name.length < 2 || name.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Introduz um nome e e-mail válidos.');
  const customer = { name, email };
  if (body.method === 'mbway') {
    let phone = String(body.phone || '').replace(/[\s()+-]/g, '');
    if (phone.startsWith('00351')) phone = phone.slice(5);
    else if (phone.startsWith('351')) phone = phone.slice(3);
    if (!/^9[1236]\d{7}$/.test(phone)) throw new Error('Introduz um número de telemóvel português válido.');
    const nif = String(body.nif || '').replace(/\s/g, '');
    if (!/^[1235689]\d{8}$/.test(nif)) throw new Error('Introduz um NIF português válido.');
    let sum = 0;
    for (let i = 0; i < 8; i++) sum += Number(nif[i]) * (9 - i);
    const digit = 11 - (sum % 11);
    if (Number(nif[8]) !== (digit >= 10 ? 0 : digit)) throw new Error('O NIF não passou a validação.');
    customer.phone = '+351' + phone;
    customer.document = { number: nif };
  }
  return customer;
}
export function mbwayPayload(customer, orderId, origin) {
  return { amount: MBWAY_BASE_CENTS, paymentMethod: 'mbway', currency: 'EUR', customer: { ...customer, externalRef: orderId }, items: [{ title: TITLE, unitPrice: MBWAY_BASE_CENTS, quantity: 1, tangible: false, externalRef: orderId }], metadata: orderId, postbackUrl: origin + '/api/eagle/webhook' };
}
export function matchesPayment(order, tx) {
  if (String(tx.id) !== order.transaction_id || (tx.currency && tx.currency !== 'EUR')) return false;
  if (tx.vat) return Number(tx.vat.totalAmount) === TOTAL_CENTS && Number(tx.vat.baseAmount) === MBWAY_BASE_CENTS;
  // A consulta real MB WAY retorna o montante base sem objeto vat.
  // Conferir a base enviada é suficiente; o total esperado continua a ser
  // base + IVA de 23%, aplicado pela Eagle conforme o contrato documentado.
  // Se vat vier presente, o ramo acima continua a exigir os valores exatos.
  return Number(tx.amount) === MBWAY_BASE_CENTS ||
    (order.verified_total === TOTAL_CENTS && Number(tx.amount) === TOTAL_CENTS);
}


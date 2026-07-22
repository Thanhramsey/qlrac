export const BANK_BIN_MAP: Record<string, string> = {
  vietinbank: '970415',
  icb: '970415',
  vietcombank: '970436',
  vcb: '970436',
  mbbank: '970422',
  mb: '970422',
  agribank: '970405',
  vba: '970405',
  bidv: '970418',
  techcombank: '970407',
  tcb: '970407',
  vpbank: '970432',
  vpb: '970432',
  tpbank: '970423',
  tpb: '970423',
  acb: '970416',
  sacombank: '970403',
  stb: '970403',
  hdbank: '970437',
  hdb: '970437',
  msb: '970426',
  shb: '970443',
  seabank: '970440',
  vib: '970441',
  eximbank: '970431',
  eib: '970431',
  lpbank: '970449',
  lienvietpostbank: '970449',
  lpb: '970449',
  ocb: '970448',
  bvbank: '970454',
  vietcapitalbank: '970454',
  baovietbank: '970438',
  vietbank: '970433',
  bacabank: '970409',
};

export function resolveBankBin(bankNameOrCode?: string): string {
  if (!bankNameOrCode) return '970415'; // Default VietinBank BIN
  const clean = bankNameOrCode.trim().toLowerCase();
  
  // If it's already a 6-digit numeric BIN code
  if (/^\d{6}$/.test(clean)) {
    return clean;
  }

  for (const [key, bin] of Object.entries(BANK_BIN_MAP)) {
    if (clean.includes(key)) {
      return bin;
    }
  }

  return '970415';
}

function crc16ccitt(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function removeVietnameseAccents(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim();
}

export function generateVietQREMVCo({
  bankBin,
  accountNo,
  amount,
  memo,
}: {
  bankBin: string;
  accountNo: string;
  amount?: number;
  memo?: string;
}): string {
  const cleanAccount = accountNo.replace(/[^a-zA-Z0-9]/g, '');
  const cleanBin = resolveBankBin(bankBin);
  
  // Tag 38: Merchant Account Information
  const guidField = '0010A000000727'; // NAPAS GUID
  const bankBinTag = `00${String(cleanBin.length).padStart(2, '0')}${cleanBin}`;
  const accountNoTag = `01${String(cleanAccount.length).padStart(2, '0')}${cleanAccount}`;
  const beneVal = `${bankBinTag}${accountNoTag}`;
  const beneTag = `01${String(beneVal.length).padStart(2, '0')}${beneVal}`;
  const serviceTag = '0208QRIBFTTA'; // Quick transfer to account

  const tag38Val = `${guidField}${beneTag}${serviceTag}`;
  const tag38 = `38${String(tag38Val.length).padStart(2, '0')}${tag38Val}`;

  // Tag 53: Currency (704 = VND)
  const tag53 = '5303704';

  // Tag 54: Amount
  let tag54 = '';
  if (amount && amount > 0) {
    const amtStr = String(Math.round(amount));
    tag54 = `54${String(amtStr.length).padStart(2, '0')}${amtStr}`;
  }

  // Tag 58: Country Code
  const tag58 = '5802VN';

  // Tag 62: Additional Data Field (Memo)
  let tag62 = '';
  if (memo) {
    const cleanMemo = removeVietnameseAccents(memo).slice(0, 25);
    if (cleanMemo) {
      const memoTag = `08${String(cleanMemo.length).padStart(2, '0')}${cleanMemo}`;
      tag62 = `62${String(memoTag.length).padStart(2, '0')}${memoTag}`;
    }
  }

  const rawPayloadWithoutCRC = `000201010212${tag38}${tag53}${tag54}${tag58}${tag62}6304`;
  const crc = crc16ccitt(rawPayloadWithoutCRC);
  return `${rawPayloadWithoutCRC}${crc}`;
}

export function buildVietQRImageUrl({
  bankBin,
  accountNo,
  accountName,
  amount,
  memo,
}: {
  bankBin: string;
  accountNo: string;
  accountName?: string;
  amount?: number;
  memo?: string;
}): string {
  const cleanBin = resolveBankBin(bankBin);
  const cleanAccount = accountNo.replace(/[^a-zA-Z0-9]/g, '');
  let url = `https://img.vietqr.io/image/${cleanBin}-${cleanAccount}-compact2.png`;
  
  const params: string[] = [];
  if (amount && amount > 0) {
    params.push(`amount=${Math.round(amount)}`);
  }
  if (memo) {
    params.push(`addInfo=${encodeURIComponent(removeVietnameseAccents(memo))}`);
  }
  if (accountName) {
    params.push(`accountName=${encodeURIComponent(removeVietnameseAccents(accountName))}`);
  }

  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }

  return url;
}

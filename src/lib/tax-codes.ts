export const taxAccountMapping: Record<string, string> = {
  "411121": "PPh Pasal 21",
  "411122": "PPh Pasal 22",
  "411123": "PPh Pasal 22 Impor",
  "411124": "PPh Pasal 23",
  "411125": "PPh Pasal 25/29 Orang Pribadi",
  "411126": "PPh Pasal 25/29 Badan",
  "411127": "PPh Pasal 26",
  "411128": "PPh Final Pasal 4 ayat 2",
  "411129": "PPh Non Migas Lainnya (PPh Pasal 15)",
  "411149": "PPh Non Migas DTP",
  "411111": "PPh Minyak Bumi",
  "411112": "PPh Gas Alam",
  "411119": "PPh Migas Lainnya",
  "411211": "PPN Dalam Negeri",
  "411212": "PPN Impor",
  "411219": "PPN Lainnya",
  "411221": "PPnBM Dalam Negeri",
  "411222": "PPnBM Impor",
  "411229": "PPnBM Lainnya",
  "411313": "PBB Sektor Perkebunan",
  "411314": "PBB Sektor Perhutanan",
  "411315": "PBB Sektor Minerba",
  "411316": "PBB Sektor Migas",
  "411317": "PBB Sektor Panas Bumi",
  "411319": "PBB Sektor Lainnya",
  "411611": "Bea Meterai",
  "411612": "Penjualan Meterai",
  "411613": "Pajak Penjualan Batubara",
  "411619": "Pajak Tidak Langsung Lainnya",
  "411621": "Bunga/Denda Penagihan PPh",
  "411622": "Bunga/Denda Penagihan PPN",
  "411623": "Bunga/Denda Penagihan PPnBM",
  "411624": "Bunga/Denda Penagihan PTLL",
  "411141": "PPh 21 DTP",
  "411142": "PPh 22 DTP",
  "411143": "PPh 22 Impor DTP",
  "411144": "PPh 23 DTP",
  "411145": "PPh 25/29 OP DTP",
  "411146": "PPh 25/29 Badan DTP",
  "411147": "PPh 26 DTP",
  "411148": "PPh Final DTP",
  "411241": "PPN DTP",
  "411242": "PPnBM DTP",
  "411631": "Bunga/Denda PPh DTP",
  "425911": "Penerimaan Kembali Belanja Pegawai",
  "425913": "Penerimaan Kembali Belanja Modal",
  "511119": "Belanja Pembulatan Gaji",
  "511124": "Belanja Tunjangan Fungsional",
  "511151": "Belanja Tunjangan Khusus",
  "811111": "PFK Iuran Wajib Pegawai (IWP)",
  "811131": "PFK Iuran Jaminan Kesehatan (2%)",
  "811132": "PFK Iuran Jaminan Kesehatan (4%)",
  "811135": "PFK Iuran Jaminan Kesehatan PPNPN Daerah",
  "811141": "PFK Iuran Jaminan Kesehatan PPNPN Pusat",
  "811147": "PFK Iuran Jaminan Kesehatan PPPK Pusat"
};

export function getTaxAccountLabel(code: string | null | undefined): string {
  if (!code) return "-";
  // Extract digits only if the code has prefix like KAP or dots
  const cleanCode = code.replace(/\D/g, "");
  // Try to find exact match or prefix
  if (taxAccountMapping[cleanCode]) return taxAccountMapping[cleanCode];
  
  // Hande case where code might be longer/shorter (fallback)
  return "-";
}

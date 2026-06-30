export const COMPANY = {
    name: 'RETOUR GAGNANT BÉNIN',
    rccm: 'RB/COT/26 B 42001',
    ifu: '3202644573981',
    address: 'Haie-Vive Cocotiers, Cotonou, Bénin',
    phone: '+229 01 60 32 21 21 / +229 01 94 35 50 50',
    email: 'contact@retourgagnantbenin.bj',
    website: 'www.retourgagnantbenin.bj',
} as const

export function companyHeaderLines(): string[] {
    return [
        COMPANY.name,
        `RCCM : ${COMPANY.rccm}    |    IFU : ${COMPANY.ifu}`,
        `${COMPANY.address}    |    ${COMPANY.phone}`,
        `${COMPANY.email}    |    ${COMPANY.website}`,
    ]
}

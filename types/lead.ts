export interface OracleAnswers {
    lien_benin?: string
    preuve_origine?: string | string[]
    motivation?: string
    pays_residence?: string
    message_libre?: string
    origin?: string
    objective?: string
    timeline?: string
    budget?: string
    experience?: string
}

export interface Lead {
    id: string
    client_nom: string
    client_prenom: string
    client_email: string
    client_whatsapp?: string
    recommended_service: string
    recommended_slug: string
    eligibility_score: number
    has_origins: boolean
    answers: OracleAnswers
    objective?: string
    is_contacted: boolean
    created_at: string
}

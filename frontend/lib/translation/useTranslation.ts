'use client'

import { useContext } from 'react'
import { TranslationContext } from './TranslationProvider'

export const useTranslation = () => useContext(TranslationContext)

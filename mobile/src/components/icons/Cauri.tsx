/* ═══════════════════════════════════════════════════════════
   Cauri — l'icône de la Consultation Fa.

   Aucune bibliothèque générique n'a de cauri. On mettait donc une étoile, puis
   un coquillage en spirale : deux symboles qui ne disent pas ce dont il s'agit.
   Or le cauri N'EST PAS un ornement — c'est l'instrument même de la divination
   Fa : le Bokonon jette les cauris, et c'est leur face, ouverte ou fermée, qui
   parle.

   Dessin : l'ovale du coquillage, la fente dentelée en son centre — la seule
   forme à laquelle on reconnaît un cauri au premier regard.

   Trait, proportions et `currentColor` alignés sur Lucide (viewBox 24, trait
   2, extrémités arrondies), pour qu'elle ne détonne pas à côté des autres.
═══════════════════════════════════════════════════════════ */
import React from 'react'
import Svg, { Path, Ellipse } from 'react-native-svg'

interface Props {
    size?: number
    color?: string
    strokeWidth?: number
}

export default function Cauri({ size = 24, color = 'currentColor', strokeWidth = 2 }: Props) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            {/* Le corps : un ovale légèrement plus haut que large, comme le
                coquillage vu de dos. */}
            <Ellipse
                cx={12}
                cy={12}
                rx={6.5}
                ry={8.5}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
            />
            {/* La fente centrale, resserrée aux deux extrémités. */}
            <Path
                d="M12 5.2c1.15 1.9 1.15 11.7 0 13.6-1.15-1.9-1.15-11.7 0-13.6Z"
                stroke={color}
                strokeWidth={strokeWidth * 0.75}
                strokeLinejoin="round"
            />
            {/* Les dents : ce qui distingue le cauri de n'importe quel galet. */}
            <Path
                d="M10.9 9.2h2.2M10.75 12h2.5M10.9 14.8h2.2"
                stroke={color}
                strokeWidth={strokeWidth * 0.7}
                strokeLinecap="round"
            />
        </Svg>
    )
}

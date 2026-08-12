"use client";

/**
 * Mini-icônes 3D bespoke (CSS 3D, aucune dépendance, aucun asset) pour la
 * section « parcours ». Une icône par étape, animation continue (rotation /
 * flottement), profondeur via couche arrière translateZ. Charte Bénin
 * (vert #008751 / or #FCD116). Respecte prefers-reduced-motion (statique).
 */
export type StepKind = "contact" | "plan" | "build" | "install";

const GREEN = "#0a9d63";
const GREEN_D = "#04643c";
const GOLD = "#FCD116";

function Bubble() {
    return (
        <svg viewBox="0 0 48 44" width="46" height="42">
            <path d="M8 4h32a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H22l-9 7v-7H8a6 6 0 0 1-6-6V10a6 6 0 0 1 6-6Z" fill="url(#bg)" />
            <circle cx="16" cy="17" r="2.6" fill={GOLD} />
            <circle cx="24" cy="17" r="2.6" fill="#fff" opacity="0.85" />
            <circle cx="32" cy="17" r="2.6" fill={GOLD} />
            <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={GREEN} /><stop offset="1" stopColor={GREEN_D} /></linearGradient></defs>
        </svg>
    );
}
function Pin() {
    return (
        <svg viewBox="0 0 48 48" width="42" height="42">
            <path d="M24 3c-9 0-16 7-16 16 0 11 16 26 16 26s16-15 16-26C40 10 33 3 24 3Z" fill="url(#pg)" />
            <circle cx="24" cy="18" r="6.5" fill={GOLD} />
            <defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={GREEN} /><stop offset="1" stopColor={GREEN_D} /></linearGradient></defs>
        </svg>
    );
}
function Gear({ r = 15, fill = GREEN }: { r?: number; fill?: string }) {
    return (
        <svg viewBox="0 0 48 48" width="40" height="40">
            {[...Array(8)].map((_, i) => (
                <rect key={i} x="22" y="1.5" width="4" height="8" rx="1" fill={fill} transform={`rotate(${i * 45} 24 24)`} />
            ))}
            <circle cx="24" cy="24" r={r} fill={fill} />
            <circle cx="24" cy="24" r="5.5" fill="#fff" />
        </svg>
    );
}
function KeyIcon() {
    return (
        <svg viewBox="0 0 48 48" width="44" height="44">
            <circle cx="15" cy="24" r="9" fill="none" stroke={GOLD} strokeWidth="5" />
            <rect x="22" y="21.5" width="22" height="5" rx="2" fill={GOLD} />
            <rect x="38" y="26" width="5" height="7" rx="1.5" fill={GOLD} />
            <rect x="31" y="26" width="4" height="6" rx="1.5" fill={GOLD} />
            <circle cx="15" cy="24" r="3" fill="#04643c" />
        </svg>
    );
}

export default function Step3DIcon({ kind }: { kind: StepKind }) {
    return (
        <div className={`s3d s3d--${kind}`} aria-hidden="true">
            {kind === "plan" && <span className="s3d-ring" />}
            <div className="s3d-scene">
                {kind === "build" ? (
                    <>
                        <span className="s3d-face s3d-g1"><Gear r={15} fill={GREEN} /></span>
                        <span className="s3d-face s3d-g2"><Gear r={11} fill={GOLD} /></span>
                    </>
                ) : (
                    <>
                        <span className="s3d-back">{kind === "contact" ? <Bubble /> : kind === "plan" ? <Pin /> : <KeyIcon />}</span>
                        <span className="s3d-face">{kind === "contact" ? <Bubble /> : kind === "plan" ? <Pin /> : <KeyIcon />}</span>
                    </>
                )}
            </div>

            <style jsx>{`
                .s3d { position: relative; width: 56px; height: 56px; display: grid; place-items: center; perspective: 480px; }
                .s3d-scene { position: relative; transform-style: preserve-3d; display: grid; place-items: center; }
                .s3d-face, .s3d-back { grid-area: 1 / 1; display: grid; place-items: center; }
                .s3d-back { filter: brightness(0.55) blur(0.4px); transform: translateZ(-7px); }

                /* Contact : la bulle pivote doucement + flotte */
                .s3d--contact .s3d-scene { animation: s3d-swingY 3.4s ease-in-out infinite, s3d-float 3.4s ease-in-out infinite; }
                /* Plan : épingle qui bascule, anneau d'itinéraire qui tourne */
                .s3d--plan .s3d-scene { animation: s3d-swingY 4s ease-in-out infinite, s3d-float 3s ease-in-out infinite; }
                .s3d-ring { position: absolute; width: 54px; height: 54px; border: 2px dashed ${GOLD}; border-radius: 50%; opacity: 0.65; animation: s3d-spin 7s linear infinite; }
                /* Build : engrenages qui tournent en sens inverse */
                .s3d--build .s3d-scene { transform: rotateX(12deg); }
                .s3d--build .s3d-g1 { animation: s3d-g1 5s linear infinite; }
                .s3d--build .s3d-g2 { animation: s3d-g2 3.6s linear infinite; }
                /* Install : clé qui pivote et flotte */
                .s3d--install .s3d-scene { animation: s3d-turnY 6s ease-in-out infinite, s3d-float 3.2s ease-in-out infinite; }

                @keyframes s3d-swingY { 0%,100% { transform: rotateY(-24deg); } 50% { transform: rotateY(24deg); } }
                @keyframes s3d-turnY { 0%,100% { transform: rotateY(-32deg); } 50% { transform: rotateY(32deg); } }
                @keyframes s3d-float { 0%,100% { translate: 0 -3px; } 50% { translate: 0 3px; } }
                @keyframes s3d-spin { to { transform: rotate(360deg); } }
                @keyframes s3d-g1 { from { transform: translate(-7px,3px) rotate(0); } to { transform: translate(-7px,3px) rotate(360deg); } }
                @keyframes s3d-g2 { from { transform: translate(9px,-6px) rotate(0); } to { transform: translate(9px,-6px) rotate(-360deg); } }

                @media (prefers-reduced-motion: reduce) {
                    .s3d-scene, .s3d-ring, .s3d-g1, .s3d-g2 { animation: none !important; }
                }
            `}</style>
        </div>
    );
}

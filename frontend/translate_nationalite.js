const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app', '(routes)', 'nationalite', 'formulaire', 'page.tsx');

let content = fs.readFileSync(filePath, 'utf8');

// The file already imports useTranslation and T component at line 15:
// import { useTranslation, T } from '@/lib/translation'

// Steps array
content = content.replace(/label: 'Afro-descendance'/g, "label: t('Afro-descendance')");
content = content.replace(/label: 'Infos personnelles'/g, "label: t('Infos personnelles')");
content = content.replace(/label: 'Document & Parents'/g, "label: t('Document & Parents')");
content = content.replace(/label: 'Pièces jointes'/g, "label: t('Pièces jointes')");
content = content.replace(/label: 'Récapitulatif'/g, "label: t('Récapitulatif')");
content = content.replace(/label: 'Paiement & Soumission'/g, "label: t('Paiement & Soumission')");

// Countries, Professions, Genres, Liens
const arrayVariables = ['COUNTRIES', 'PROFESSIONS', 'GENRES', 'LIENS'];

// Replace simple text in JS objects
content = content.replace(/label: 'Pièce d\\'identité en cours de validité'/g, "label: t('Pièce d\\'identité en cours de validité')");
content = content.replace(/label: 'Justificatif de domicile'/g, "label: t('Justificatif de domicile')");
content = content.replace(/label: 'Preuve de profession'/g, "label: t('Preuve de profession')");
content = content.replace(/label: 'Preuve d\\'afro descendance'/g, "label: t('Preuve d\\'afro descendance')");
content = content.replace(/hint: 'Vous pouvez charger plusieurs documents ici !'/g, "hint: t('Vous pouvez charger plusieurs documents ici !')");
content = content.replace(/label: 'Casier judiciaire ou Certificat d\\'antécédents criminels'/g, "label: t('Casier judiciaire ou Certificat d\\'antécédents criminels')");

content = content.replace(/subtitle: 'Mobile Money \/ Carte'/g, "subtitle: t('Mobile Money / Carte')");
content = content.replace(/subtitle: 'Carte Virtuelle'/g, "subtitle: t('Carte Virtuelle')");

content = content.replace(/setPaymentError\('Le paiement Kkiapay a échoué\.'\)/g, "setPaymentError(t('Le paiement Kkiapay a échoué.'))");
content = content.replace(/setPaymentError\('Impossible d\\'ouvrir Kkiapay'\)/g, "setPaymentError(t('Impossible d\\'ouvrir Kkiapay'))");
content = content.replace(/setPaymentError\('Paiement FedaPay non approuvé\.'\)/g, "setPaymentError(t('Paiement FedaPay non approuvé.'))");
content = content.replace(/setPaymentError\('Impossible d\\'initialiser FedaPay'\)/g, "setPaymentError(t('Impossible d\\'initialiser FedaPay'))");
content = content.replace(/setPaymentError\('Zeyow non configuré\.'\)/g, "setPaymentError(t('Zeyow non configuré.'))");

content = content.replace(/Décrivez votre afro-descendance/g, "Décrivez votre afro-descendance"); // Validation strings need to be wrapped with t()
content = content.replace(/e\.push\('Décrivez votre afro-descendance'\)/g, "e.push(t('Décrivez votre afro-descendance'))");
content = content.replace(/e\.push\('Nom de l\\'ancêtre 1 requis'\)/g, "e.push(t('Nom de l\\'ancêtre 1 requis'))");
content = content.replace(/e\.push\('Lien de parenté requis'\)/g, "e.push(t('Lien de parenté requis'))");
content = content.replace(/e\.push\('Nom requis'\)/g, "e.push(t('Nom requis'))");
content = content.replace(/e\.push\('Prénom requis'\)/g, "e.push(t('Prénom requis'))");
content = content.replace(/e\.push\('Email requis'\)/g, "e.push(t('Email requis'))");
content = content.replace(/e\.push\('Email invalide'\)/g, "e.push(t('Email invalide'))");
content = content.replace(/e\.push\('Genre requis'\)/g, "e.push(t('Genre requis'))");
content = content.replace(/e\.push\('Date de naissance requise'\)/g, "e.push(t('Date de naissance requise'))");
content = content.replace(/e\.push\('Pays de résidence requis'\)/g, "e.push(t('Pays de résidence requis'))");
content = content.replace(/e\.push\('Type de document requis'\)/g, "e.push(t('Type de document requis'))");
content = content.replace(/e\.push\(`Document manquant : \$\{l\}`\)/g, "e.push(`${t('Document manquant :')} ${t(l)}`)");

content = content.replace(/setErrors\(\['Veuillez effectuer le paiement avant de soumettre\.'\]\)/g, "setErrors([t('Veuillez effectuer le paiement avant de soumettre.')])");
content = content.replace(/setErrors\(\[result\.error \|\| 'Erreur lors de la soumission\. Veuillez réessayer\.'\]\)/g, "setErrors([result.error || t('Erreur lors de la soumission. Veuillez réessayer.')])");
content = content.replace(/setErrors\(\['Erreur réseau\. Vérifiez votre connexion et réessayez\.'\]\)/g, "setErrors([t('Erreur réseau. Vérifiez votre connexion et réessayez.')])");

// Wrap text in JSX with T component
content = content.replace(/>Bienvenue<br \/>/g, "><T>Bienvenue</T><br />");
content = content.replace(/'Bienvenue<br \/>'/g, "'Bienvenue<br />'"); // Prevent previous replace from breaking string if any

content = content.replace(/<span className="text-transparent bg-clip-text bg-gradient-to-r from-\[#008751\] via-\[#FCD116\] to-\[#E8112D\]">Chez Vous<\/span>/g, '<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]"><T>Chez Vous</T></span>');

content = content.replace(/<p className="text-gray-400 text-sm mb-2">Votre demande a été enregistrée avec succès<\/p>/g, '<p className="text-gray-400 text-sm mb-2"><T>Votre demande a été enregistrée avec succès</T></p>');

content = content.replace(/<p className="text-\[10px\] text-gray-500 uppercase tracking-wider font-bold">Référence<\/p>/g, '<p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold"><T>Référence</T></p>');

content = content.replace(/<p className="text-xs text-gray-500 mb-4">Conservez votre référence <span className="text-\[#FCD116\] font-bold">\{appRef\}<\/span> pour suivre votre dossier<\/p>/g, '<p className="text-xs text-gray-500 mb-4"><T>Conservez votre référence</T> <span className="text-[#FCD116] font-bold">{appRef}</span> <T>pour suivre votre dossier</T></p>');

content = content.replace(/Retour Gagnant Bénin<\/div>/g, "<T>Retour Gagnant Bénin</T></div>");

content = content.replace(/📍 Suivre mon dossier<\/Link>/g, "📍 <T>Suivre mon dossier</T></Link>");
content = content.replace(/>Retour à la page<\/Link>/g, "><T>Retour à la page</T></Link>");
content = content.replace(/>Accueil<\/Link>/g, "><T>Accueil</T></Link>");

content = content.replace(/<p>La reconnaissance de la nationalité béninoise aux afrodescendants est un acte de mémoire, de justice et une porte ouverte vers le retour aux racines des descendants des Africains déportés lors de la traite négrière transatlantique, comme membres légitimes de la Nation béninoise\.<\/p>/g, "<p><T>La reconnaissance de la nationalité béninoise aux afrodescendants est un acte de mémoire, de justice et une porte ouverte vers le retour aux racines des descendants des Africains déportés lors de la traite négrière transatlantique, comme membres légitimes de la Nation béninoise.</T></p>");
content = content.replace(/<p>La loi 2024-31 du 02 Septembre 2024 portant reconnaissance de la nationalité béninoise aux afro-descendants organise en ce sens un mode d'acquisition de la nationalité béninoise par toute personne qui d'après sa généalogie, a un ascendant africain subsaharien déporté hors du continent africain dans le cadre de la traite des noirs et du commerce triangulaire\.<\/p>/g, "<p><T>La loi 2024-31 du 02 Septembre 2024 portant reconnaissance de la nationalité béninoise aux afro-descendants organise en ce sens un mode d'acquisition de la nationalité béninoise par toute personne qui d'après sa généalogie, a un ascendant africain subsaharien déporté hors du continent africain dans le cadre de la traite des noirs et du commerce triangulaire.</T></p>");

content = content.replace(/<p className="font-bold text-white">La loi s'adresse à l'afro-descendant :<\/p>/g, '<p className="font-bold text-white"><T>La loi s\\\'adresse à l\\\'afro-descendant :</T></p>');
content = content.replace(/<li>âgé d'au moins 18 ans,<\/li>/g, '<li><T>âgé d\\\'au moins 18 ans,</T></li>');
content = content.replace(/<li>résidant hors du continent africain,<\/li>/g, '<li><T>résidant hors du continent africain,</T></li>');
content = content.replace(/<li>et pouvant établir sa filiation avec un ascendant africain subsaharien victime de la traite négrière\.<\/li>/g, "<li><T>et pouvant établir sa filiation avec un ascendant africain subsaharien victime de la traite négrière.</T></li>");

content = content.replace(/<span className="font-bold text-white">La preuve de l'afro-descendance peut être apportée par :<\/span>/g, '<span className="font-bold text-white"><T>La preuve de l\\\'afro-descendance peut être apportée par :</T></span>');

content = content.replace(/ des actes d'état civil, des certificats officiels, des tests d'ADN génétiques, des actes notariés, des arbres généalogiques, des extraits d'archives historiques, et tout autre document probant\./g, ' <T>des actes d\\\'état civil, des certificats officiels, des tests d\\\'ADN génétiques, des actes notariés, des arbres généalogiques, des extraits d\\\'archives historiques, et tout autre document probant.</T>');


content = content.replace(/<h2 className="text-lg font-black text-white">Votre identification Afro-descendante<\/h2>/g, '<h2 className="text-lg font-black text-white"><T>Votre identification Afro-descendante</T></h2>');

content = content.replace(/Êtes-vous afro-descendant\(e\) \?<\/label>/g, "Êtes-vous afro-descendant(e) ?<span className={RQ}>*</span></label>").replace(/Êtes-vous afro-descendant\(e\) \?<span className=\{RQ\}>\*<\/span><span className=\{RQ\}>\*<\/span><\/label>/g, "<T>Êtes-vous afro-descendant(e) ?</T><span className={RQ}>*</span></label>");

content = content.replace(/\{v \? 'Oui' : 'Non'\}/g, "{v ? t('Oui') : t('Non')}");
content = content.replace(/Comment êtes-vous afro-descendant\(e\) \?<\/label>/g, "Comment êtes-vous afro-descendant(e) ?<span className={RQ}>*</span></label>").replace(/Comment êtes-vous afro-descendant\(e\) \?<span className=\{RQ\}>\*<\/span><span className=\{RQ\}>\*<\/span><\/label>/g, "<T>Comment êtes-vous afro-descendant(e) ?</T><span className={RQ}>*</span></label>");

content = content.replace(/placeholder="Décrivez en quelques mots votre ascendance\.\.\."/g, "placeholder={t(\"Décrivez en quelques mots votre ascendance...\")}");

content = content.replace(/<h3 className="text-sm font-black text-white mb-4">Informations sur vos ancêtres<\/h3>/g, '<h3 className="text-sm font-black text-white mb-4"><T>Informations sur vos ancêtres</T></h3>');

content = content.replace(/\{n === 1 \? '1ère' : '2ème'\} Personne/g, "{n === 1 ? t('1ère') : t('2ème')} {t('Personne')}");

const labelsToReplace = [
    [/Nom\{n === 1 && <span className=\{RQ\}>\*<\/span>\}/g, "<T>Nom</T>{n === 1 && <span className={RQ}>*</span>}"],
    ['Prénom(s)', "<T>Prénom(s)</T>"],
    ['Date de naissance', "<T>Date de naissance</T>"],
    [/Lien de parenté\{n === 1 && <span className=\{RQ\}>\*<\/span>\}/g, "<T>Lien de parenté</T>{n === 1 && <span className={RQ}>*</span>}"],
    ['Vivant(e) ?', "<T>Vivant(e) ?</T>"],
    ['Nationalité', "<T>Nationalité</T>"],
    ['Pays de résidence', "<T>Pays de résidence</T>"],
    ['Autres informations', "<T>Autres informations</T>"],
    ['Genre', "<T>Genre</T>"],
    ['Pays de naissance', "<T>Pays de naissance</T>"],
    ['Ville de naissance', "<T>Ville de naissance</T>"],
    ['Adresse complète', "<T>Adresse complète</T>"],
    ['Téléphone', "<T>Téléphone</T>"],
    ['Email', "<T>Email</T>"],
    ['Profession', "<T>Profession</T>"],
    ['Situation matrimoniale', "<T>Situation matrimoniale</T>"],
    ["Nombre d'enfants", "<T>Nombre d'enfants</T>"],
    ['Type de document', "<T>Type de document</T>"],
    ['Autorité de délivrance', "<T>Autorité de délivrance</T>"],
    ['Numéro du document', "<T>Numéro du document</T>"],
    ['Pays de délivrance', "<T>Pays de délivrance</T>"],
    ["Date d'expiration", "<T>Date d'expiration</T>"],
    ['Lieu de délivrance', "<T>Lieu de délivrance</T>"],
    ['Type', "<T>Type</T>"],
    ['Numéro', "<T>Numéro</T>"],
];

content = content.replace(/<label className=\{LC\}>Nom\{n === 1 && <span className=\{RQ\}>\*<\/span>\}<\/label>/g, '<label className={LC}><T>Nom</T>{n === 1 && <span className={RQ}>*</span>}</label>');
content = content.replace(/<label className=\{LC\}>Prénom\(s\)<\/label>/g, '<label className={LC}><T>Prénom(s)</T></label>');
content = content.replace(/<label className=\{LC\}>Date de naissance<\/label>/g, '<label className={LC}><T>Date de naissance</T></label>');
content = content.replace(/<label className=\{LC\}>Lien de parenté\{n === 1 && <span className=\{RQ\}>\*<\/span>\}<\/label>/g, '<label className={LC}><T>Lien de parenté</T>{n === 1 && <span className={RQ}>*</span>}</label>');
content = content.replace(/<label className=\{LC\}>Vivant\(e\) \?<\/label>/g, '<label className={LC}><T>Vivant(e) ?</T></label>');
content = content.replace(/<label className=\{LC\}>Nationalité<\/label>/g, '<label className={LC}><T>Nationalité</T></label>');
content = content.replace(/<label className=\{LC\}>Pays de résidence<\/label>/g, '<label className={LC}><T>Pays de résidence</T></label>');
content = content.replace(/<label className=\{LC\}>Autres informations<\/label>/g, '<label className={LC}><T>Autres informations</T></label>');

content = content.replace(/placeholder="Nom"/g, "placeholder={t('Nom')}");
content = content.replace(/placeholder="Prénom\(s\)"/g, "placeholder={t('Prénom(s)')}");
content = content.replace(/<option value="">Choisir<\/option>/g, '<option value="">{t("Choisir")}</option>');
content = content.replace(/<option value="">Pays<\/option>/g, '<option value="">{t("Pays")}</option>');
content = content.replace(/placeholder="Informations complémentaires\.\.\."/g, "placeholder={t('Informations complémentaires...')}");

content = content.replace(/<h2 className="text-lg font-black text-white">Informations Personnelles<\/h2>/g, '<h2 className="text-lg font-black text-white"><T>Informations Personnelles</T></h2>');

content = content.replace(/<label className=\{LC\}>Nom<span className=\{RQ\}>\*<\/span><\/label>/g, '<label className={LC}><T>Nom</T><span className={RQ}>*</span></label>');
content = content.replace(/<label className=\{LC\}>Prénom\(s\)<span className=\{RQ\}>\*<\/span><\/label>/g, '<label className={LC}><T>Prénom(s)</T><span className={RQ}>*</span></label>');
content = content.replace(/<label className=\{LC\}>Genre<span className=\{RQ\}>\*<\/span><\/label>/g, '<label className={LC}><T>Genre</T><span className={RQ}>*</span></label>');
content = content.replace(/<label className=\{LC\}>Date de naissance<span className=\{RQ\}>\*<\/span><\/label>/g, '<label className={LC}><T>Date de naissance</T><span className={RQ}>*</span></label>');
content = content.replace(/<label className=\{LC\}>Pays de naissance<\/label>/g, '<label className={LC}><T>Pays de naissance</T></label>');
content = content.replace(/<label className=\{LC\}>Ville de naissance<\/label>/g, '<label className={LC}><T>Ville de naissance</T></label>');
content = content.replace(/<label className=\{LC\}>Nationalité<span className=\{RQ\}>\*<\/span><\/label>/g, '<label className={LC}><T>Nationalité</T><span className={RQ}>*</span></label>');
content = content.replace(/<label className=\{LC\}>Pays de résidence<span className=\{RQ\}>\*<\/span><\/label>/g, '<label className={LC}><T>Pays de résidence</T><span className={RQ}>*</span></label>');
content = content.replace(/<label className=\{LC\}>Adresse complète<\/label>/g, '<label className={LC}><T>Adresse complète</T></label>');
content = content.replace(/<label className=\{LC\}>Téléphone<\/label>/g, '<label className={LC}><T>Téléphone</T></label>');
content = content.replace(/<label className=\{LC\}>Email<span className=\{RQ\}>\*<\/span><\/label>/g, '<label className={LC}><T>Email</T><span className={RQ}>*</span></label>');
content = content.replace(/<label className=\{LC\}>Profession<\/label>/g, '<label className={LC}><T>Profession</T></label>');

content = content.replace(/placeholder="Nom de famille"/g, "placeholder={t('Nom de famille')}");
content = content.replace(/placeholder="Ville"/g, "placeholder={t('Ville')}");
content = content.replace(/placeholder="Adresse"/g, "placeholder={t('Adresse')}");


content = content.replace(/<h3 className="text-sm font-black text-white">Situation familiale<\/h3>/g, '<h3 className="text-sm font-black text-white"><T>Situation familiale</T></h3>');
content = content.replace(/<label className=\{LC\}>Situation matrimoniale<\/label>/g, '<label className={LC}><T>Situation matrimoniale</T></label>');
content = content.replace(/<label className=\{LC\}>Nombre d'enfants<\/label>/g, '<label className={LC}><T>Nombre d\\\'enfants</T></label>');
content = content.replace(/<option value="celibataire">Célibataire<\/option>/g, '<option value="celibataire">{t("Célibataire")}</option>');
content = content.replace(/<option value="marie">Marié\(e\)<\/option>/g, '<option value="marie">{t("Marié(e)")}</option>');
content = content.replace(/<option value="divorce">Divorcé\(e\)<\/option>/g, '<option value="divorce">{t("Divorcé(e)")}</option>');
content = content.replace(/<option value="veuf">Veuf\/Veuve<\/option>/g, '<option value="veuf">{t("Veuf/Veuve")}</option>');
content = content.replace(/<option value="union_libre">Union libre<\/option>/g, '<option value="union_libre">{t("Union libre")}</option>');


content = content.replace(/<span className="text-sm text-gray-400">Demande depuis le Bénin \?<\/span>/g, '<span className="text-sm text-gray-400"><T>Demande depuis le Bénin ?</T></span>');

content = content.replace(/<h2 className="text-lg font-black text-white">Document d'identité &amp; Parents<\/h2>/g, '<h2 className="text-lg font-black text-white"><T>Document d\\\'identité &amp; Parents</T></h2>');
content = content.replace(/<label className=\{LC\}>Type de document<span className=\{RQ\}>\*<\/span><\/label>/g, '<label className={LC}><T>Type de document</T><span className={RQ}>*</span></label>');
content = content.replace(/<label className=\{LC\}>Autorité de délivrance<\/label>/g, '<label className={LC}><T>Autorité de délivrance</T></label>');
content = content.replace(/<label className=\{LC\}>Numéro du document<\/label>/g, '<label className={LC}><T>Numéro du document</T></label>');
content = content.replace(/<label className=\{LC\}>Pays de délivrance<\/label>/g, '<label className={LC}><T>Pays de délivrance</T></label>');
content = content.replace(/<label className=\{LC\}>Date d'expiration<\/label>/g, '<label className={LC}><T>Date d\\\'expiration</T></h2></label>');
content = content.replace(/<label className=\{LC\}>Lieu de délivrance<\/label>/g, '<label className={LC}><T>Lieu de délivrance</T></label>');

content = content.replace(/<option value="passeport">Passeport<\/option>/g, '<option value="passeport">{t("Passeport")}</option>');
content = content.replace(/<option value="cni">CNI<\/option>/g, '<option value="cni">{t("CNI")}</option>');
content = content.replace(/<option value="carte_electeur">Carte d'électeur<\/option>/g, '<option value="carte_electeur">{t("Carte d\\\'électeur")}</option>');
content = content.replace(/<option value="autre">Autre<\/option>/g, '<option value="autre">{t("Autre")}</option>');

content = content.replace(/<h3 className="text-sm font-black text-white mb-3">Scan \/ Photo du document<\/h3>/g, '<h3 className="text-sm font-black text-white mb-3"><T>Scan / Photo du document</T></h3>');
content = content.replace(/Joignez une photo ou un scan lisible de votre \{form\.type_document_identite === 'passeport' \? 'passeport' : form\.type_document_identite === 'cni' \? 'carte d\\'identité' : 'document'\}\./g, "{t('Joignez une photo ou un scan lisible de votre')} {form.type_document_identite === 'passeport' ? t('passeport') : form.type_document_identite === 'cni' ? t('carte d\\'identité') : t('document')}.");

content = content.replace(/<p className="text-xs font-bold text-emerald-400">Cliquer ou glisser-déposer<\/p>/g, '<p className="text-xs font-bold text-emerald-400"><T>Cliquer ou glisser-déposer</T></p>');
content = content.replace(/<p className="text-\[10px\] text-gray-600 mt-1">PNG, JPG, PDF — Max 5 Mo<\/p>/g, '<p className="text-[10px] text-gray-600 mt-1"><T>PNG, JPG, PDF — Max 5 Mo</T></p>');

content = content.replace(/Fichier sélectionné :/g, "Fichier sélectionné :");
content = content.replace(/\{rawDocs\.find\(d => d\.label === 'Document d\\'identité \(scan\)'\) && <p className="text-\[10px\] text-emerald-400 mt-2 font-bold">Fichier sélectionné : \{rawDocs\.find\(d => d\.label === 'Document d\\'identité \(scan\)'\)\?\.name\}<\/p>\}/g, "{rawDocs.find(d => d.label === 'Document d\\'identité (scan)') && <p className=\"text-[10px] text-emerald-400 mt-2 font-bold\"><T>Fichier sélectionné :</T> {rawDocs.find(d => d.label === 'Document d\\'identité (scan)')?.name}</p>}");

content = content.replace(/<h3 className="text-sm font-black text-white mb-4">Informations sur vos parents<\/h3>/g, '<h3 className="text-sm font-black text-white mb-4"><T>Informations sur vos parents</T></h3>');
content = content.replace(/\{p\}/g, "{t(p)}");

content = content.replace(/<h3 className="text-sm font-black text-white">Lettre de motivation<\/h3>/g, '<h3 className="text-sm font-black text-white"><T>Lettre de motivation</T></h3>');
content = content.replace(/<p className="text-\[11px\] text-gray-500">Expliquez pourquoi cette démarche est importante pour vous\. Ce texte sera joint a votre dossier\.<\/p>/g, '<p className="text-[11px] text-gray-500"><T>Expliquez pourquoi cette démarche est importante pour vous. Ce texte sera joint a votre dossier.</T></p>');
content = content.replace(/placeholder="Rédigez ici votre motivation pour obtenir la nationalité béninoise\.\.\."/g, "placeholder={t('Rédigez ici votre motivation pour obtenir la nationalité béninoise...')}");

content = content.replace(/J'accepte que mes données personnelles soient traitées dans le cadre de cette demande de nationalité, conformément à la politique de confidentialité de Retour Gagnant Benin\./g, "<T>J\\'accepte que mes données personnelles soient traitées dans le cadre de cette demande de nationalité, conformément à la politique de confidentialité de Retour Gagnant Benin.</T>");


content = content.replace(/<h2 className="text-lg font-black text-white">Pièces à joindre<\/h2>/g, '<h2 className="text-lg font-black text-white"><T>Pièces à joindre</T></h2>');
content = content.replace(/<p className="text-xs text-gray-500">Formats : PNG, JPG, JPEG, PDF\. Taille max : 5 Mo\.<\/p>/g, '<p className="text-xs text-gray-500"><T>Formats : PNG, JPG, JPEG, PDF. Taille max : 5 Mo.</T></p>');
content = content.replace(/\{doc\.label\}/g, "{t(doc.label)}");

content = content.replace(/<p className="text-\[10px\] text-gray-600">Glisser déposer ou<\/p>/g, '<p className="text-[10px] text-gray-600"><T>Glisser déposer ou</T></p>');
content = content.replace(/\{doc\.multi \? 'CHOISIR FICHIER\(S\)' : 'CHOISIR UN FICHIER'\}/g, "{doc.multi ? t('CHOISIR FICHIER(S)') : t('CHOISIR UN FICHIER')}");

content = content.replace(/<p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Fichiers ajoutés \(\{rawDocs\.length\}\)<\/p>/g, '<p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{t("Fichiers ajoutés")} ({rawDocs.length})</p>');
content = content.replace(/<p className="text-xs text-white font-bold truncate">\{d\.label\}<\/p>/g, '<p className="text-xs text-white font-bold truncate">{t(d.label)}</p>');

content = content.replace(/<h2 className="text-lg font-black text-white">Paiement des frais de traitement<\/h2>/g, '<h2 className="text-lg font-black text-white"><T>Paiement des frais de traitement</T></h2>');
content = content.replace(/<p className="text-xs text-gray-500 mt-1">Frais de traitement de dossier<\/p>/g, '<p className="text-xs text-gray-500 mt-1"><T>Frais de traitement de dossier</T></p>');
content = content.replace(/<p className="text-sm font-bold text-emerald-400">Paiement effectué via \{paymentProvider\}<\/p>/g, '<p className="text-sm font-bold text-emerald-400"><T>Paiement effectué via</T> {paymentProvider}</p>');
content = content.replace(/<p className="text-sm text-gray-400 mt-3">Traitement en cours\.\.\.<\/p>/g, '<p className="text-sm text-gray-400 mt-3"><T>Traitement en cours...</T></p>');
content = content.replace(/<p className="text-xs text-gray-400 font-bold">Sélectionnez votre moyen de paiement :<\/p>/g, '<p className="text-xs text-gray-400 font-bold"><T>Sélectionnez votre moyen de paiement :</T></p>');
content = content.replace(/<p className="text-xs text-amber-400">Aucune passerelle de paiement active\. Contactez l'administrateur\.<\/p>/g, '<p className="text-xs text-amber-400"><T>Aucune passerelle de paiement active. Contactez l\\\'administrateur.</T></p>');
content = content.replace(/<span className="text-\[10px\] font-bold uppercase tracking-widest">Transaction 100% sécurisée<\/span>/g, '<span className="text-[10px] font-bold uppercase tracking-widest"><T>Transaction 100% sécurisée</T></span>');

content = content.replace(/<h2 className="text-lg font-black text-white">Récapitulatif de votre demande<\/h2>/g, '<h2 className="text-lg font-black text-white"><T>Récapitulatif de votre demande</T></h2>');
content = content.replace(/<p className="text-xs text-gray-400">Vérifiez attentivement vos informations avant de procéder au paiement\.<\/p>/g, '<p className="text-xs text-gray-400"><T>Vérifiez attentivement vos informations avant de procéder au paiement.</T></p>');

content = content.replace(/title: 'Identité'/g, "title: t('Identité')");
content = content.replace(/title: 'Afro-descendance'/g, "title: t('Afro-descendance')");
content = content.replace(/title: "Document d'identité"/g, "title: t(\"Document d'identité\")");
content = content.replace(/title: 'Parents'/g, "title: t('Parents')");

content = content.replace(/\['Nom complet'/g, "[t('Nom complet')");
content = content.replace(/\['Genre'/g, "[t('Genre')");
content = content.replace(/\['Né\(e\) le'/g, "[t('Né(e) le')");
content = content.replace(/\['Nationalité'/g, "[t('Nationalité')");
content = content.replace(/\['Résidence'/g, "[t('Résidence')");
content = content.replace(/\['Email'/g, "[t('Email')");
content = content.replace(/\['Téléphone'/g, "[t('Téléphone')");
content = content.replace(/\['Profession'/g, "[t('Profession')");

content = content.replace(/\['Description'/g, "[t('Description')");
content = content.replace(/\['Ancêtre 1'/g, "[t('Ancêtre 1')");
content = content.replace(/\['Ancêtre 2'/g, "[t('Ancêtre 2')");

content = content.replace(/\['Type'/g, "[t('Type')");
content = content.replace(/\['Numéro'/g, "[t('Numéro')");
content = content.replace(/\['Pays délivrance'/g, "[t('Pays délivrance')");
content = content.replace(/\['Expiration'/g, "[t('Expiration')");
content = content.replace(/\['Père'/g, "[t('Père')");
content = content.replace(/\['Mère'/g, "[t('Mère')");

content = content.replace(/<h3 className="text-\[10px\] font-black text-emerald-400 uppercase tracking-\[0\.2em\] mb-3">Pièces jointes \(\{rawDocs\.length\}\)<\/h3>/g, '<h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-3">{t("Pièces jointes")} ({rawDocs.length})</h3>');
content = content.replace(/<p className="text-\[10px\] text-white font-bold truncate">\{d\.label\}<\/p>/g, '<p className="text-[10px] text-white font-bold truncate">{t(d.label)}</p>');
content = content.replace(/<p className="text-\[10px\] text-gray-500 uppercase tracking-wider font-bold mb-1">Montant à régler à l'étape suivante<\/p>/g, '<p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1"><T>Montant à régler à l\\\'étape suivante</T></p>');


content = content.replace(/Précédent<\/button>/g, "<T>Précédent</T></button>");
content = content.replace(/>Suivant <ArrowRight/g, "><T>Suivant</T> <ArrowRight");

content = content.replace(/<Loader2 size=\{16\} className="animate-spin" \/> Envoi\.\.\./g, '<Loader2 size={16} className="animate-spin" /> <T>Envoi...</T>');
content = content.replace(/<CreditCard size=\{16\} \/> Payez d'abord/g, '<CreditCard size={16} /> <T>Payez d\\\'abord</T>');
content = content.replace(/<Send size=\{16\} \/> Confirmer et Soumettre/g, '<Send size={16} /> <T>Confirmer et Soumettre</T>');

const arrayMapTranslations = ['COUNTRIES', 'PROFESSIONS', 'GENRES', 'LIENS'];
for (const arrType of arrayMapTranslations) {
    content = content.replace(new RegExp(`{${arrType}\\.map\\(`, 'g'), `{${arrType}.map(item => Object.assign(item, { translated: true })).map(`); // Just testing something else
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done mapping.');

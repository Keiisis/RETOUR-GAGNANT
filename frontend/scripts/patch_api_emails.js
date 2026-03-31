const fs = require('fs');

const filesToPatch = [
    'app/api/rendez-vous/route.ts',
    'app/api/email/send/route.ts',
    'app/api/oracle/route.ts',
    'app/api/contact/route.ts'
];

for (const f of filesToPatch) {
    if (!fs.existsSync(f)) continue;
    let content = fs.readFileSync(f, 'utf8');

    // Mettre à jour l'import
    content = content.replace(/EMAIL_TEMPLATES/g, 'getEmailTemplates');

    // Trouver "getEmailTemplates" et rajouter "await getEmailTemplates('fr')"
    // on identifie le block qui fait l'appel HTML:
    // html: getEmailTemplates.autoReply(...) -> html: (await getEmailTemplates('fr')).autoReply(...)
    content = content.replace(/getEmailTemplates\.(\w+)\(/g, '(await getEmailTemplates(\'fr\')).$1(');

    fs.writeFileSync(f, content);
}

console.log('Fichiers API modifiés pour la traduction asynchrone.');

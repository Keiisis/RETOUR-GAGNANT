import { analyzeRequestFast } from './frontend/lib/waf/engine';

const urlPath = '/';
const searchParams = "id=1'+UNION+SELECT+*+FROM+users--";
const userAgent = 'Mozilla/5.0';

const verdict = analyzeRequestFast('GET', urlPath, searchParams, userAgent);
console.log(JSON.stringify(verdict, null, 2));

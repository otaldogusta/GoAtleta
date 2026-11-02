// Prepare a local-only certificate chain. This never installs trust, opens a port or changes firewall rules.
import { generateKeyPairSync, randomBytes, X509Certificate, createPrivateKey } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import forge from 'node-forge';

export function privateLiveHost(host) {
  if (typeof host !== 'string' || !/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  const p=host.split('.').map(Number);
  return p.every(n=>n>=0&&n<=255) && (p[0]===10 || p[0]===192&&p[1]===168 || p[0]===172&&p[1]>=16&&p[1]<=31);
}
const pair=()=>generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
function certificate(publicKey,subject,issuer,extensions,days) {
  const cert=forge.pki.createCertificate();cert.publicKey=forge.pki.publicKeyFromPem(publicKey);
  cert.serialNumber='01'+randomBytes(15).toString('hex');
  cert.validity.notBefore=new Date(Date.now()-300000);cert.validity.notAfter=new Date(Date.now()+days*86400000);
  cert.setSubject([{name:'commonName',value:subject}]);cert.setIssuer([{name:'commonName',value:issuer}]);cert.setExtensions(extensions);
  return cert;
}
export function prepareLiveTls({host,directory=join(homedir(),'.config','goatleta','scouting-live')}={}) {
  if(!privateLiveHost(host))throw new Error('Informe o IPv4 privado do notebook na mesma rede do celular.');
  const root=resolve(directory),ca=join(root,'go-atleta-live-ca.crt'),caKey=join(root,'go-atleta-live-ca.key'),cert=join(root,'camera.crt'),key=join(root,'camera.key');
  const files=[ca,caKey,cert,key];
  if(files.some(existsSync)) {
    if(!files.every(existsSync))throw new Error('Configuração local incompleta; arquivos existentes foram preservados.');
    const existing=new X509Certificate(readFileSync(cert)),authority=new X509Certificate(readFileSync(ca));
    if(!authority.ca || !existing.checkIP(host) || Date.parse(existing.validTo)<=Date.now() || !existing.verify(authority.publicKey) || !existing.checkPrivateKey(createPrivateKey(readFileSync(key))))throw new Error('Certificado local incompatível ou expirado. Use outra pasta para uma nova preparação.');
    return {host,directory:root,ca,cert,key,fingerprint:authority.fingerprint256,reused:true,trustInstalled:false};
  }
  mkdirSync(root,{recursive:true,mode:0o700});
  const authorityKeys=pair(),serverKeys=pair(),name='Go Atleta Live Local';
  const authority=certificate(authorityKeys.publicKey,name,name,[{name:'basicConstraints',cA:true,critical:true},{name:'keyUsage',keyCertSign:true,cRLSign:true,critical:true},{name:'subjectKeyIdentifier'}],30);
  authority.sign(forge.pki.privateKeyFromPem(authorityKeys.privateKey),forge.md.sha256.create());
  const server=certificate(serverKeys.publicKey,'Go Atleta Camera Local',name,[{name:'basicConstraints',cA:false,critical:true},{name:'keyUsage',digitalSignature:true,keyEncipherment:true,critical:true},{name:'extKeyUsage',serverAuth:true},{name:'subjectAltName',altNames:[{type:7,ip:host},{type:7,ip:'127.0.0.1'},{type:2,value:'localhost'}]}],7);
  server.sign(forge.pki.privateKeyFromPem(authorityKeys.privateKey),forge.md.sha256.create());
  writeFileSync(ca,forge.pki.certificateToPem(authority),{flag:'wx',mode:0o644});
  writeFileSync(caKey,authorityKeys.privateKey,{flag:'wx',mode:0o600});
  writeFileSync(cert,forge.pki.certificateToPem(server),{flag:'wx',mode:0o644});
  writeFileSync(key,serverKeys.privateKey,{flag:'wx',mode:0o600});
  const result={host,directory:root,ca,cert,key,fingerprint:new X509Certificate(readFileSync(ca)).fingerprint256,reused:false,trustInstalled:false};
  writeFileSync(join(root,'local-config.json'),JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
  return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),options={};
  for(let i=0;i<args.length;i+=2){if(!['--host','--directory'].includes(args[i])||!args[i+1]||options[args[i].slice(2)])throw new Error('Argumentos inválidos.');options[args[i].slice(2)]=args[i+1];}
  console.log(JSON.stringify(prepareLiveTls(options),null,2));
}

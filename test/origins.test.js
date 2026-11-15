import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalOrigin,originConfig} from '../server/origins.js';
test('Render e frontend autorizado são origens distintas e exatas',()=>{
 const c=originConfig({PUBLIC_APP_URL:'https://ofertaspy-td1y.onrender.com/',FRONTEND_URL:'https://oferta.vercel.app'});
 assert.equal(c.apiOrigin,'https://ofertaspy-td1y.onrender.com');assert.equal(c.frontendOrigin,'https://oferta.vercel.app');
 assert.equal(c.allowedOrigins.has('https://oferta.vercel.app'),true);assert.equal(c.allowedOrigins.has('https://other.vercel.app'),false);assert.equal(c.allowedOrigins.has('https://oferta.vercel.app.attacker.example'),false);assert.equal(c.allowedOrigins.has(undefined),false);
});
test('configuração antiga no Render continua válida sem FRONTEND_URL',()=>{
 const c=originConfig({PUBLIC_APP_URL:'https://backend.example'});assert.equal(c.allowedOrigins.size,1);assert.equal(c.allowedOrigins.has('https://backend.example'),true);
});
test('origens recusam HTTP, credenciais, curingas, caminhos e parâmetros',()=>{
 for(const value of ['http://oferta.vercel.app','https://*.vercel.app','https://user:pass@oferta.vercel.app','https://oferta.vercel.app/checkout','https://oferta.vercel.app?foo=bar','https://oferta.vercel.app#hash','bad-url'])assert.throws(()=>canonicalOrigin(value,'FRONTEND_URL'));
});

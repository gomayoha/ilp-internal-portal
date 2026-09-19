import {createRemoteJWKSet,jwtVerify} from 'jose';
const denied=message=>Object.assign(Error(message),{status:403});
export function authorizeClaims(payload,config){
 if(payload.tid!==config.tenantId||payload.azp!==config.clientId||typeof payload.oid!=='string')throw denied('This Microsoft account or application is not approved.');
 if(!(payload.scp||'').split(' ').includes('Portal.Access'))throw denied('Portal access permission is missing.');
 const roles=Array.isArray(payload.roles)?payload.roles:[];
 const admin=roles.includes('Portal.Admin')&&config.adminIds.includes(payload.oid);
 if(!admin&&!roles.includes('Portal.Employee'))throw denied('Your account has not been assigned portal access. Please contact HR.');
 return {id:payload.oid,email:payload.preferred_username||payload.email||payload.name||'Employee',role:admin?'admin':'employee'};
}
export function createIdentityVerifier(config,keyResolver){
 const guid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 for(const value of [config.tenantId,config.clientId,config.audience,...config.adminIds])if(!guid.test(value))throw Error('Microsoft tenant, application and object IDs must be valid GUIDs.');
 const keys=keyResolver||createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${config.tenantId}/discovery/v2.0/keys`));
 return async token=>{const {payload}=await jwtVerify(token,keys,{algorithms:['RS256'],issuer:`https://login.microsoftonline.com/${config.tenantId}/v2.0`,audience:config.audience,requiredClaims:['exp','iat','tid','oid','azp','scp']});return authorizeClaims(payload,config)};
}

import {PublicClientApplication,InteractionRequiredAuthError} from '@azure/msal-browser';
let client,settings;
window.PortalAuth={
 async setup(config){settings=config;client=new PublicClientApplication({auth:{clientId:config.clientId,authority:'https://login.microsoftonline.com/'+config.tenantId,redirectUri:config.redirectUri},cache:{cacheLocation:'sessionStorage'}});await client.initialize();const result=await client.handleRedirectPromise();if(result?.account)client.setActiveAccount(result.account);else if(client.getAllAccounts().length)client.setActiveAccount(client.getAllAccounts()[0])},
 hasAccount(){return !!client?.getActiveAccount()},
 async getToken(){if(!client?.getActiveAccount())return null;try{const result=await client.acquireTokenSilent({scopes:[settings.scope],account:client.getActiveAccount()});return result.accessToken}catch(e){if(e instanceof InteractionRequiredAuthError)throw Error('Your Microsoft session needs renewal. Sign out and sign in again.');throw e}},
 async signIn(){await client.loginRedirect({scopes:[settings.scope],prompt:'select_account'})},
 async signOut(){if(client)await client.logoutRedirect({account:client.getActiveAccount(),postLogoutRedirectUri:settings.redirectUri})}
};

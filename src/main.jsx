import { lazy,Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider,useAuth } from './auth.jsx';
import { Access,Setup,AuthSplash,Recovery,PasswordRecovery } from './access.jsx';
import './styles.css';
const Workspace=lazy(()=>import('./workspace.jsx'));
function App(){
 const auth=useAuth();
 if(new URLSearchParams(location.search).get('configurar')==='1')return <Setup/>;
 if(auth.status==='unconfigured')return <Setup/>;
 if(['loading','signing-out'].includes(auth.status))return <AuthSplash signingOut={auth.status==='signing-out'}/>;
 if(['recovery-error','storage-error'].includes(auth.status))return <Recovery/>;
 if(auth.status==='authenticated'&&auth.passwordRecovery)return <PasswordRecovery/>;
 return auth.status==='authenticated'?<Suspense fallback={<AuthSplash/>}><Workspace key={auth.session.user.id}/></Suspense>:<Access/>;
}
createRoot(document.getElementById('root')).render(<AuthProvider><App/></AuthProvider>);

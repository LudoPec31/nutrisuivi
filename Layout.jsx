import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useUnreadCount } from '../hooks/useChat'

const IconDash = () => <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="1" width="5.5" height="5.5" rx="1.5" fill="currentColor"/><rect x="8.5" y="1" width="5.5" height="5.5" rx="1.5" fill="currentColor" opacity=".4"/><rect x="1" y="8.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" opacity=".4"/><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" opacity=".4"/></svg>
const IconClients = () => <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="5.5" cy="4.5" r="2.5" fill="currentColor"/><path d="M1 13c0-2.5 2-4.5 4.5-4.5S10 10.5 10 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="11.5" cy="4.5" r="1.8" fill="currentColor" opacity=".4"/><path d="M13.5 11.5c0-1.4-.9-2.6-2.2-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".4"/></svg>
const IconMsg = () => <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 2h11a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 2.5V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
const IconLogout = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2H2a1 1 0 00-1 1v8a1 1 0 001 1h3M9.5 9.5L12 7m0 0L9.5 4.5M12 7H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IconUser = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M1.5 12.5C2 10 4.2 8.5 7 8.5s5 1.5 5.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const avatarColors = ['av-green', 'av-purple', 'av-amber', 'av-coral']
function avatarColor(str) {
  if (!str) return 'av-green'
  let h = 0; for (let c of str) h = (h * 31 + c.charCodeAt(0)) & 0xFFFF
  return avatarColors[h % avatarColors.length]
}

export default function Layout() {
  const { user, profile, signOut, isNutritionist } = useAuth()
  const navigate = useNavigate()
  const unreadCount = useUnreadCount(user?.id)

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-name">NutriSuivi</div>
          <div className="sidebar-logo-sub">{profile?.full_name || 'Espace nutrition'}</div>
        </div>
        <nav className="sidebar-nav">
          {isNutritionist ? (
            <>
              <div className="sidebar-section">Navigation</div>
              <NavLink to="/" end className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
                <IconDash /> Tableau de bord
              </NavLink>
              <NavLink to="/clients" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
                <IconClients /> Clients
              </NavLink>
              <NavLink to="/messages" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}
                style={{justifyContent:'space-between'}}>
                <span style={{display:'flex',alignItems:'center',gap:9}}><IconMsg /> Messagerie</span>
                {unreadCount > 0 && (
                  <span style={{background:'var(--green)',color:'#fff',borderRadius:10,
                    fontSize:10,fontWeight:600,padding:'1px 6px',minWidth:18,textAlign:'center'}}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </NavLink>
            </>
          ) : (
            <>
              <div className="sidebar-section">Mon espace</div>
              <NavLink to="/mon-espace" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
                <IconUser /> Mon suivi
              </NavLink>
              <NavLink to="/mon-chat" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}
                style={{justifyContent:'space-between'}}>
                <span style={{display:'flex',alignItems:'center',gap:9}}><IconMsg /> Messagerie</span>
                {unreadCount > 0 && (
                  <span style={{background:'var(--green)',color:'#fff',borderRadius:10,
                    fontSize:10,fontWeight:600,padding:'1px 6px',minWidth:18,textAlign:'center'}}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </NavLink>
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:10}}>
            <div className={`avatar av-sm ${avatarColor(profile?.full_name)}`}>
              {getInitials(profile?.full_name)}
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:500,color:'var(--gray-900)'}}>{profile?.full_name || '—'}</div>
              <div style={{fontSize:11,color:'var(--gray-400)'}}>{isNutritionist ? 'Nutritionniste' : 'Client'}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{width:'100%',justifyContent:'center'}} onClick={handleLogout}>
            <IconLogout /> Déconnexion
          </button>
        </div>
      </aside>
      <div className="main-area">
        <Outlet />
      </div>
    </div>
  )
}

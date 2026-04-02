import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const avatarColors = ['av-green', 'av-purple', 'av-amber', 'av-coral']
function avatarColor(str) {
  if (!str) return 'av-green'
  let h = 0; for (let c of str) h = (h * 31 + c.charCodeAt(0)) & 0xFFFF
  return avatarColors[h % avatarColors.length]
}
function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [stats, setStats] = useState({ total: 0, actifs: 0, alertes: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchClients()
  }, [])

  async function fetchClients() {
    const { data } = await supabase
      .from('clients')
      .select('*, profiles(full_name, email), pesees(poids, date)')
      .order('created_at', { ascending: false })
      .limit(6)

    if (data) {
      setClients(data)
      const total = data.length
      const actifs = data.filter(c => c.statut === 'actif').length
      const alertes = data.filter(c => c.statut === 'alerte').length
      setStats({ total, actifs, alertes })
    }
    setLoading(false)
  }

  function statusBadge(statut) {
    const map = {
      actif: { cls: 'badge-green', label: 'Actif' },
      maintien: { cls: 'badge-purple', label: 'Maintien' },
      alerte: { cls: 'badge-amber', label: 'À relancer' },
      nouveau: { cls: 'badge-gray', label: 'Nouveau' },
      termine: { cls: 'badge-gray', label: 'Terminé' },
    }
    const s = map[statut] || map.nouveau
    return <span className={`badge ${s.cls}`}>{s.label}</span>
  }

  function lastPesee(pesees) {
    if (!pesees?.length) return null
    const sorted = [...pesees].sort((a, b) => new Date(b.date) - new Date(a.date))
    return sorted[0]
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'Aurélie'

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Bonjour {firstName} 👋</div>
        <div className="topbar-actions">
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/clients')}>
            + Nouveau client
          </button>
        </div>
      </div>
      <div className="page-content fade-in">
        <div style={{display:'grid', gridTemplate:'1fr/repeat(4,1fr)', gap:12, marginBottom:24}}>
          <div className="metric-card">
            <div className="metric-label">Clients total</div>
            <div className="metric-value">{stats.total}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Actifs</div>
            <div className="metric-value">{stats.actifs}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">À relancer</div>
            <div className="metric-value" style={{color: stats.alertes > 0 ? 'var(--amber)' : undefined}}>{stats.alertes}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Taux de suivi</div>
            <div className="metric-value">{stats.total > 0 ? Math.round((stats.actifs / stats.total) * 100) : 0}%</div>
          </div>
        </div>

        <div className="card">
          <div style={{fontWeight:500, marginBottom:14}}>Clients récents</div>
          {loading ? (
            <div style={{color:'var(--gray-400)',fontSize:13,padding:'20px 0',textAlign:'center'}}>Chargement…</div>
          ) : clients.length === 0 ? (
            <div style={{color:'var(--gray-400)',fontSize:13,padding:'20px 0',textAlign:'center'}}>
              Aucun client pour l'instant —{' '}
              <span style={{color:'var(--green)',cursor:'pointer'}} onClick={() => navigate('/clients')}>créez le premier</span>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Objectif</th>
                    <th>Dernière pesée</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => {
                    const lp = lastPesee(c.pesees)
                    return (
                      <tr key={c.id} onClick={() => navigate(`/clients/${c.id}`)}>
                        <td>
                          <div style={{display:'flex', alignItems:'center', gap:10}}>
                            <div className={`avatar av-sm ${avatarColor(c.profiles?.full_name)}`}>
                              {getInitials(c.profiles?.full_name)}
                            </div>
                            <div>
                              <div style={{fontWeight:500}}>{c.profiles?.full_name || '—'}</div>
                              <div style={{fontSize:11,color:'var(--gray-400)'}}>{c.profiles?.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{color:'var(--gray-600)'}}>{c.objectif_label || '—'}</td>
                        <td style={{color:'var(--gray-600)'}}>
                          {lp ? `${lp.poids} kg` : '—'}
                        </td>
                        <td>{statusBadge(c.statut)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { calcNeeds, ACTIVITY_FACTORS, GOAL_ADJUSTMENTS, imcCategory } from '../lib/nutrition'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const REPAS = ['Petit-déjeuner', 'Déjeuner', 'Collation', 'Dîner']

export default function MonEspacePage() {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('accueil')
  const [client, setClient] = useState(null)
  const [pesees, setPesees] = useState([])
  const [plan, setPlan] = useState(null)
  const [newPoids, setNewPoids] = useState('')
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [user])

  async function fetchData() {
    if (!user) return
    const [clientRes, peseesRes, planRes] = await Promise.all([
      supabase.from('clients').select('*').eq('user_id', user.id).single(),
      supabase.from('pesees').select('*').order('date'),
      supabase.from('plans').select('*').order('created_at', { ascending: false }).limit(1).single()
    ])

    if (clientRes.data) {
      setClient(clientRes.data)
      if (peseesRes.data) {
        // Filtrer les pesées de ce client
        const cp = peseesRes.data.filter(p => p.client_id === clientRes.data.id)
        setPesees(cp)
      }
    }
    if (planRes.data) setPlan(planRes.data)
    setLoading(false)
  }

  async function addPesee() {
    if (!newPoids || !client) return
    setSaving(true)
    await supabase.from('pesees').insert({ client_id: client.id, poids: parseFloat(newPoids), date: newDate })
    setNewPoids('')
    setSaving(false)
    fetchData()
  }

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',flex:1,color:'var(--gray-400)'}}>Chargement…</div>

  const name = profile?.full_name || 'vous'
  const firstName = name.split(' ')[0]
  const needs = client ? calcNeeds({
    weight: client.weight, height: client.height,
    age: client.age, sex: client.sex,
    activity: client.activity, goal: client.goal
  }) : null

  const lastPesee = pesees.length > 0 ? pesees[pesees.length - 1].poids : client?.weight
  const premierePesee = pesees.length > 0 ? pesees[0].poids : client?.weight
  const delta = lastPesee && premierePesee ? (lastPesee - premierePesee).toFixed(1) : null

  const chartData = pesees.map(p => ({
    date: format(parseISO(p.date), 'd MMM', { locale: fr }),
    poids: p.poids
  }))

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Bonjour {firstName} 👋</div>
      </div>
      <div className="page-content fade-in">
        <div className="tabs">
          {['accueil','plan','suivi'].map(t => (
            <button key={t} className={`tab-btn${tab===t?' active':''}`} onClick={() => setTab(t)}>
              {t==='accueil'?'Mon profil':t==='plan'?'Mon plan alimentaire':'Mon suivi poids'}
            </button>
          ))}
        </div>

        {tab === 'accueil' && (
          !client ? (
            <div className="card" style={{textAlign:'center',padding:'40px',color:'var(--gray-400)'}}>
              Votre dossier est en cours de création par votre nutritionniste.
            </div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              <div className="card">
                <div style={{fontWeight:500,marginBottom:14}}>Mon profil</div>
                <div className="result-rows">
                  <div className="result-row"><span className="result-row-label">Objectif</span><span className="result-row-val">{client.objectif_label}</span></div>
                  <div className="result-row"><span className="result-row-label">Poids actuel</span><span className="result-row-val">{client.weight} kg</span></div>
                  <div className="result-row"><span className="result-row-label">Poids cible</span><span className="result-row-val">{client.weight_target ? `${client.weight_target} kg` : '—'}</span></div>
                  <div className="result-row"><span className="result-row-label">IMC</span><span className="result-row-val">{needs?.imc}</span></div>
                  <div className="result-row"><span className="result-row-label">Activité</span><span className="result-row-val">{ACTIVITY_FACTORS[client.activity]?.label}</span></div>
                </div>
              </div>
              {needs && (
                <div className="card">
                  <div style={{fontWeight:500,marginBottom:14}}>Mes besoins du jour</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
                    <div className="metric-card">
                      <div className="metric-label">Calories cible</div>
                      <div className="metric-value" style={{color:'var(--green-dark)'}}>{needs.target}</div>
                      <div className="metric-sub">kcal / jour</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Protéines</div>
                      <div className="metric-value">{needs.proteins}</div>
                      <div className="metric-sub">g / jour</div>
                    </div>
                  </div>
                  {[
                    { label: 'Protéines', g: needs.proteins, kcal: needs.proteins * 4, color: '#1D9E75' },
                    { label: 'Glucides', g: needs.carbs, kcal: needs.carbs * 4, color: '#534AB7' },
                    { label: 'Lipides', g: needs.fats, kcal: needs.fats * 9, color: '#EF9F27' }
                  ].map(m => {
                    const pct = Math.round((m.kcal / needs.target) * 100)
                    return (
                      <div key={m.label} className="macro-bar-row">
                        <div className="macro-bar-label">{m.label}</div>
                        <div className="macro-bar-track"><div className="macro-bar-fill" style={{width:`${pct}%`,background:m.color}} /></div>
                        <div className="macro-bar-pct">{m.g}g</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        )}

        {tab === 'plan' && (
          !plan ? (
            <div className="card" style={{textAlign:'center',padding:'40px',color:'var(--gray-400)'}}>
              Votre plan alimentaire sera bientôt disponible. Votre nutritionniste le prépare pour vous.
            </div>
          ) : (
            <div>
              <div className="card" style={{marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontWeight:500}}>{plan.titre}</div>
                  <div style={{fontSize:12,color:'var(--gray-400)',marginTop:2}}>{plan.calories_cible} kcal · {plan.proteines}g protéines</div>
                </div>
              </div>
              {JOURS.map(jour => {
                const repasJour = plan.data?.[jour]
                if (!repasJour) return null
                return (
                  <div key={jour} className="card" style={{marginBottom:10,padding:'14px 16px'}}>
                    <div style={{fontWeight:500,fontSize:13,marginBottom:10,color:'var(--green-dark)'}}>{jour}</div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
                      {REPAS.map(r => (
                        <div key={r}>
                          <div style={{fontSize:10,color:'var(--gray-400)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>{r}</div>
                          <div style={{fontSize:12,color:'var(--gray-900)',lineHeight:1.5}}>{repasJour[r] || '—'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {tab === 'suivi' && (
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
              <div className="metric-card">
                <div className="metric-label">Poids de départ</div>
                <div className="metric-value">{premierePesee}</div>
                <div className="metric-sub">kg</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Poids actuel</div>
                <div className="metric-value">{lastPesee}</div>
                <div className="metric-sub">kg</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Évolution</div>
                <div className="metric-value" style={{color: delta && parseFloat(delta) < 0 ? 'var(--green)' : delta && parseFloat(delta) > 0 ? 'var(--red)' : undefined}}>
                  {delta ? (parseFloat(delta) > 0 ? '+' : '') + delta : '—'}
                </div>
                <div className="metric-sub">kg depuis début</div>
              </div>
            </div>

            {chartData.length > 1 && (
              <div className="card" style={{marginBottom:16}}>
                <div style={{fontWeight:500,marginBottom:14}}>Ma courbe de poids</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData} margin={{top:5,right:20,left:0,bottom:5}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                    <XAxis dataKey="date" tick={{fontSize:11,fill:'var(--gray-400)'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize:11,fill:'var(--gray-400)'}} axisLine={false} tickLine={false} domain={['auto','auto']} />
                    <Tooltip contentStyle={{fontSize:12,borderRadius:8,border:'1px solid var(--gray-200)'}} />
                    {client?.weight_target && <ReferenceLine y={client.weight_target} stroke="var(--green)" strokeDasharray="4 4" />}
                    <Line type="monotone" dataKey="poids" stroke="var(--green)" strokeWidth={2} dot={{ r: 4, fill: 'var(--green)' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="card">
              <div style={{fontWeight:500,marginBottom:12}}>Enregistrer une pesée</div>
              <div style={{display:'flex',gap:10,alignItems:'flex-end'}}>
                <div className="form-group" style={{flex:1}}>
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
                </div>
                <div className="form-group" style={{flex:1}}>
                  <label className="form-label">Mon poids (kg)</label>
                  <input className="form-input" type="number" step="0.1" placeholder="ex : 67.5" value={newPoids} onChange={e => setNewPoids(e.target.value)} />
                </div>
                <button className="btn btn-primary" onClick={addPesee} disabled={saving || !newPoids}>
                  {saving ? '…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

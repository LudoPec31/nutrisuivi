import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ACTIVITY_FACTORS, GOAL_ADJUSTMENTS } from '../lib/nutrition'

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

const defaultForm = {
  full_name: '', email: '', password: '',
  age: '', sex: 'F', height: '', weight: '', weight_target: '',
  activity: 'moderee', goal: 'perte', notes: '',
  aliments_exces: [], repas_sautes: [], comportements: [],
  intolerances: '', aliments_aimes: '', rythme_vie: [],
}

const ALIMENTS_EXCES = ['Sucre / sucreries','Charcuterie / viande grasse','Alcool','Fast-food / plats industriels','Pain blanc / viennoiseries','Fromage en excès','Boissons sucrées / sodas','Grignotage salé']
const REPAS_SAUTES = ['Petit-déjeuner','Déjeuner','Collation matin','Collation après-midi','Dîner']
const COMPORTEMENTS = ['Mange trop vite','Grignote entre les repas','Mange devant les écrans','Mange par stress / émotions','Portions trop grandes','Mange tard le soir','Saute des repas puis compense','Peu de légumes au quotidien']
const RYTHME = ['Horaires décalés / travail de nuit','Repas souvent au restaurant','Peu de temps pour cuisiner','Mange souvent seul(e)','Déplacements fréquents','Contraintes familiales aux repas']

function CheckChip({ label, checked, onToggle }) {
  return (
    <div onClick={onToggle} style={{
      display:'inline-flex',alignItems:'center',gap:6,padding:'5px 11px',borderRadius:20,
      cursor:'pointer',fontSize:12,userSelect:'none',transition:'all 0.12s',
      background: checked ? 'var(--green-light)' : 'var(--gray-50)',
      color: checked ? 'var(--green-dark)' : 'var(--gray-600)',
      border: `1px solid ${checked ? 'var(--green-mid)' : 'var(--gray-200)'}`,
      fontWeight: checked ? 500 : 400,
    }}>
      {checked && <span style={{fontSize:9,lineHeight:1}}>✓</span>}
      {label}
    </div>
  )
}

function SectionLabel({ children }) {
  return <div style={{fontSize:11,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--gray-400)',marginBottom:8,marginTop:2}}>{children}</div>
}

function StepDots({ current, total }) {
  return (
    <div style={{display:'flex',gap:5,alignItems:'center',justifyContent:'center',marginBottom:18}}>
      {Array.from({length:total}).map((_,i) => (
        <div key={i} style={{width:i===current?20:7,height:7,borderRadius:4,
          background: i<=current ? 'var(--green)' : 'var(--gray-200)',transition:'all 0.2s'}} />
      ))}
    </div>
  )
}

export default function ClientsPage() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => { fetchClients() }, [])

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('*, profiles(full_name, email)').order('created_at', { ascending: false })
    if (data) setClients(data)
    setLoading(false)
  }

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function toggleArray(key, val) {
    setForm(f => ({ ...f, [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val] }))
  }
  function openModal() { setShowModal(true); setStep(0); setForm(defaultForm); setFormError('') }
  function closeModal() { setShowModal(false); setStep(0); setForm(defaultForm); setFormError('') }

  async function handleCreate() {
    setFormError(''); setSaving(true)
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: form.email, password: form.password,
      options: { data: { full_name: form.full_name, role: 'client' } }
    })
    if (signUpErr) { setFormError(signUpErr.message); setSaving(false); return }
    const userId = signUpData.user?.id
    if (!userId) { setFormError('Erreur création compte'); setSaving(false); return }
    await supabase.from('profiles').upsert({ id: userId, full_name: form.full_name, email: form.email, role: 'client' })
    const { error: clientErr } = await supabase.from('clients').insert({
      user_id: userId, age: parseInt(form.age), sex: form.sex,
      height: parseFloat(form.height), weight: parseFloat(form.weight),
      weight_target: parseFloat(form.weight_target) || null,
      activity: form.activity, goal: form.goal,
      objectif_label: GOAL_ADJUSTMENTS[form.goal]?.label || form.goal,
      notes: form.notes, statut: 'nouveau',
      habitudes: {
        aliments_exces: form.aliments_exces, repas_sautes: form.repas_sautes,
        comportements: form.comportements, intolerances: form.intolerances,
        aliments_aimes: form.aliments_aimes, rythme_vie: form.rythme_vie,
      }
    })
    if (clientErr) { setFormError(clientErr.message); setSaving(false); return }
    setSaving(false); closeModal(); fetchClients()
  }

  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    return (c.profiles?.full_name?.toLowerCase()||'').includes(q) || (c.profiles?.email?.toLowerCase()||'').includes(q)
  })

  function statusBadge(statut) {
    const map = { actif:{cls:'badge-green',label:'Actif'}, maintien:{cls:'badge-purple',label:'Maintien'}, alerte:{cls:'badge-amber',label:'À relancer'}, nouveau:{cls:'badge-gray',label:'Nouveau'}, termine:{cls:'badge-gray',label:'Terminé'} }
    const s = map[statut] || map.nouveau
    return <span className={`badge ${s.cls}`}>{s.label}</span>
  }

  const STEPS = ['Compte', 'Profil physique', 'Habitudes alimentaires']
  const step0Valid = form.full_name && form.email && form.password.length >= 8
  const step1Valid = form.age && form.height && form.weight

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Clients</div>
        <button className="btn btn-primary btn-sm" onClick={openModal}>+ Nouveau client</button>
      </div>
      <div className="page-content fade-in">
        <div style={{marginBottom:16}}>
          <input className="form-input" style={{maxWidth:280}} placeholder="Rechercher un client…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="card">
          {loading ? (
            <div style={{color:'var(--gray-400)',fontSize:13,padding:'20px 0',textAlign:'center'}}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{color:'var(--gray-400)',fontSize:13,padding:'30px 0',textAlign:'center'}}>
              {search ? 'Aucun résultat.' : 'Aucun client — créez le premier !'}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Nom</th><th>Âge / IMC</th><th>Objectif</th><th>Points à travailler</th><th>Statut</th></tr></thead>
                <tbody>
                  {filtered.map(c => {
                    const imc = c.height && c.weight ? (c.weight / ((c.height/100)**2)).toFixed(1) : '—'
                    const nb = c.habitudes ? (c.habitudes.aliments_exces?.length||0)+(c.habitudes.comportements?.length||0)+(c.habitudes.repas_sautes?.length||0) : 0
                    return (
                      <tr key={c.id} onClick={() => navigate(`/clients/${c.id}`)}>
                        <td>
                          <div style={{display:'flex',alignItems:'center',gap:10}}>
                            <div className={`avatar av-sm ${avatarColor(c.profiles?.full_name)}`}>{getInitials(c.profiles?.full_name)}</div>
                            <div>
                              <div style={{fontWeight:500}}>{c.profiles?.full_name||'—'}</div>
                              <div style={{fontSize:11,color:'var(--gray-400)'}}>{c.profiles?.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{color:'var(--gray-600)'}}>{c.age} ans · IMC {imc}</td>
                        <td style={{color:'var(--gray-600)'}}>{c.objectif_label||'—'}</td>
                        <td>{nb > 0 ? <span className="badge badge-amber">{nb} point{nb>1?'s':''} identifié{nb>1?'s':''}</span> : <span style={{color:'var(--gray-400)',fontSize:12}}>—</span>}</td>
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

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal fade-in" style={{maxWidth:560}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div className="modal-title" style={{marginBottom:0}}>{STEPS[step]}</div>
              <div style={{fontSize:12,color:'var(--gray-400)'}}>{step+1} / {STEPS.length}</div>
            </div>
            <StepDots current={step} total={STEPS.length} />
            {formError && <div className="auth-error">{formError}</div>}

            {step === 0 && (
              <div>
                <div className="form-grid-2" style={{marginBottom:10}}>
                  <div className="form-group"><label className="form-label">Prénom & Nom</label><input className="form-input" placeholder="Sophie Laurent" value={form.full_name} onChange={e => setF('full_name', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" placeholder="sophie@email.com" value={form.email} onChange={e => setF('email', e.target.value)} /></div>
                </div>
                <div className="form-group"><label className="form-label">Mot de passe provisoire</label><input className="form-input" type="password" placeholder="Min. 8 caractères" value={form.password} onChange={e => setF('password', e.target.value)} /></div>
              </div>
            )}

            {step === 1 && (
              <div>
                <div className="form-grid-3" style={{marginBottom:10}}>
                  <div className="form-group"><label className="form-label">Âge</label><input className="form-input" type="number" placeholder="46" value={form.age} onChange={e => setF('age', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Sexe</label><select className="form-select" value={form.sex} onChange={e => setF('sex', e.target.value)}><option value="F">Femme</option><option value="M">Homme</option></select></div>
                  <div className="form-group"><label className="form-label">Taille (cm)</label><input className="form-input" type="number" placeholder="165" value={form.height} onChange={e => setF('height', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Poids actuel (kg)</label><input className="form-input" type="number" step="0.1" placeholder="68" value={form.weight} onChange={e => setF('weight', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Poids cible (kg)</label><input className="form-input" type="number" step="0.1" placeholder="62" value={form.weight_target} onChange={e => setF('weight_target', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Activité</label><select className="form-select" value={form.activity} onChange={e => setF('activity', e.target.value)}>{Object.entries(ACTIVITY_FACTORS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
                </div>
                <div className="form-group"><label className="form-label">Objectif principal</label><select className="form-select" value={form.goal} onChange={e => setF('goal', e.target.value)}>{Object.entries(GOAL_ADJUSTMENTS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
              </div>
            )}

            {step === 2 && (
              <div style={{maxHeight:'52vh',overflowY:'auto',paddingRight:4}}>

                <SectionLabel>Aliments consommés en excès</SectionLabel>
                <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:16}}>
                  {ALIMENTS_EXCES.map(opt => <CheckChip key={opt} label={opt} checked={form.aliments_exces.includes(opt)} onToggle={() => toggleArray('aliments_exces', opt)} />)}
                </div>

                <SectionLabel>Repas souvent sautés</SectionLabel>
                <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:16}}>
                  {REPAS_SAUTES.map(opt => <CheckChip key={opt} label={opt} checked={form.repas_sautes.includes(opt)} onToggle={() => toggleArray('repas_sautes', opt)} />)}
                </div>

                <SectionLabel>Comportements à améliorer</SectionLabel>
                <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:16}}>
                  {COMPORTEMENTS.map(opt => <CheckChip key={opt} label={opt} checked={form.comportements.includes(opt)} onToggle={() => toggleArray('comportements', opt)} />)}
                </div>

                <SectionLabel>Contraintes de rythme de vie</SectionLabel>
                <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:16}}>
                  {RYTHME.map(opt => <CheckChip key={opt} label={opt} checked={form.rythme_vie.includes(opt)} onToggle={() => toggleArray('rythme_vie', opt)} />)}
                </div>

                <div className="form-grid-2" style={{marginBottom:10}}>
                  <div className="form-group">
                    <label className="form-label">Intolérances / allergies / dégoûts</label>
                    <textarea className="form-textarea" style={{minHeight:56}} placeholder="ex: gluten, lactose, poisson…" value={form.intolerances} onChange={e => setF('intolerances', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Aliments appréciés</label>
                    <textarea className="form-textarea" style={{minHeight:56}} placeholder="ex: légumineuses, poulet, fruits…" value={form.aliments_aimes} onChange={e => setF('aliments_aimes', e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes complémentaires</label>
                  <textarea className="form-textarea" style={{minHeight:48}} placeholder="Observations libres…" value={form.notes} onChange={e => setF('notes', e.target.value)} />
                </div>
              </div>
            )}

            <div className="modal-footer">
              {step > 0
                ? <button type="button" className="btn" onClick={() => setStep(s => s-1)}>← Retour</button>
                : <button type="button" className="btn" onClick={closeModal}>Annuler</button>
              }
              {step < STEPS.length - 1 ? (
                <button type="button" className="btn btn-primary"
                  disabled={(step===0 && !step0Valid)||(step===1 && !step1Valid)}
                  onClick={() => setStep(s => s+1)}>
                  Suivant →
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                  {saving ? 'Création en cours…' : '✓ Créer le client'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

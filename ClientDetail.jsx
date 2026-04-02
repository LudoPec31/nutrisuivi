import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calcNeeds, ACTIVITY_FACTORS, GOAL_ADJUSTMENTS, imcCategory } from '../lib/nutrition'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

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

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const REPAS = ['Petit-déjeuner', 'Déjeuner', 'Collation', 'Dîner']

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState('bilan')
  const [client, setClient] = useState(null)
  const [pesees, setPesees] = useState([])
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [newPoids, setNewPoids] = useState('')
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])
  const [savingPesee, setSavingPesee] = useState(false)
  const [editingClient, setEditingClient] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [genLoading, setGenLoading] = useState(false)

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    const [clientRes, peeseesRes, planRes] = await Promise.all([
      supabase.from('clients').select('*, profiles(full_name, email)').eq('id', id).single(),
      supabase.from('pesees').select('*').eq('client_id', id).order('date'),
      supabase.from('plans').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(1).single()
    ])
    if (clientRes.data) {
      setClient(clientRes.data)
      setEditForm({
        age: clientRes.data.age,
        sex: clientRes.data.sex,
        height: clientRes.data.height,
        weight: clientRes.data.weight,
        weight_target: clientRes.data.weight_target,
        activity: clientRes.data.activity,
        goal: clientRes.data.goal,
        notes: clientRes.data.notes || '',
        statut: clientRes.data.statut || 'actif'
      })
    }
    if (peeseesRes.data) setPesees(peeseesRes.data)
    if (planRes.data) setPlan(planRes.data)
    setLoading(false)
  }

  async function saveClientEdit(e) {
    e.preventDefault()
    setSaving(true)
    const goalLabel = GOAL_ADJUSTMENTS[editForm.goal]?.label || editForm.goal
    await supabase.from('clients').update({
      ...editForm,
      age: parseInt(editForm.age),
      height: parseFloat(editForm.height),
      weight: parseFloat(editForm.weight),
      weight_target: editForm.weight_target ? parseFloat(editForm.weight_target) : null,
      objectif_label: goalLabel
    }).eq('id', id)
    setSaving(false)
    setEditingClient(false)
    fetchData()
  }

  async function addPesee() {
    if (!newPoids) return
    setSavingPesee(true)
    await supabase.from('pesees').insert({ client_id: id, poids: parseFloat(newPoids), date: newDate })
    setNewPoids('')
    setSavingPesee(false)
    fetchData()
  }

  async function generatePlan() {
    if (!client) return
    setGenLoading(true)
    const needs = calcNeeds({
      weight: client.weight, height: client.height,
      age: client.age, sex: client.sex,
      activity: client.activity, goal: client.goal
    })

    // Construire le prompt avec le profil comportemental complet
    const h = client.habitudes || {}
    const habituesContext = [
      h.aliments_exces?.length ? `Aliments consommés en excès : ${h.aliments_exces.join(', ')}.` : '',
      h.repas_sautes?.length ? `Repas souvent sautés : ${h.repas_sautes.join(', ')}.` : '',
      h.comportements?.length ? `Comportements à améliorer : ${h.comportements.join(', ')}.` : '',
      h.rythme_vie?.length ? `Contraintes de vie : ${h.rythme_vie.join(', ')}.` : '',
      h.intolerances ? `Intolérances/allergies/dégoûts : ${h.intolerances}.` : '',
      h.aliments_aimes ? `Aliments appréciés : ${h.aliments_aimes}.` : '',
    ].filter(Boolean).join('\n')

    const prompt = `Tu es une nutritionniste experte. Génère un plan alimentaire sur 7 jours pour ce client.

PROFIL :
- ${client.sex === 'F' ? 'Femme' : 'Homme'}, ${client.age} ans, ${client.height}cm, ${client.weight}kg
- Objectif : ${GOAL_ADJUSTMENTS[client.goal]?.label}
- Activité : ${ACTIVITY_FACTORS[client.activity]?.label}
- Besoins : ${needs.target} kcal/jour | Protéines ${needs.proteins}g | Glucides ${needs.carbs}g | Lipides ${needs.fats}g

HABITUDES & COMPORTEMENTS :
${habituesContext || 'Aucune habitude particulière renseignée.'}

CONSIGNES IMPORTANTES :
- Adapte le plan aux habitudes identifiées : intègre progressivement des alternatives saines aux excès signalés (ex: si excès de sucre, propose des fruits plutôt que d'éliminer brutalement)
- Respecte les intolérances et dégoûts STRICTEMENT — n'inclus jamais ces aliments
- Favorise les aliments appréciés pour faciliter l'adhésion
- Si des repas sont souvent sautés, propose des options rapides/pratiques pour ces créneaux
- Tiens compte des contraintes de rythme de vie (peu de temps = recettes simples, restaurant = conseil de choix)
- Approche progressive : ne change pas tout d'un coup, améliore doucement les habitudes
- Chaque repas doit être concret, réaliste et appétissant (nom du plat + quantité indicative)

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans commentaires, exactement dans ce format :
{
  "Lundi": {"Petit-déjeuner": "...", "Déjeuner": "...", "Collation": "...", "Dîner": "..."},
  "Mardi": {"Petit-déjeuner": "...", "Déjeuner": "...", "Collation": "...", "Dîner": "..."},
  "Mercredi": {"Petit-déjeuner": "...", "Déjeuner": "...", "Collation": "...", "Dîner": "..."},
  "Jeudi": {"Petit-déjeuner": "...", "Déjeuner": "...", "Collation": "...", "Dîner": "..."},
  "Vendredi": {"Petit-déjeuner": "...", "Déjeuner": "...", "Collation": "...", "Dîner": "..."},
  "Samedi": {"Petit-déjeuner": "...", "Déjeuner": "...", "Collation": "...", "Dîner": "..."},
  "Dimanche": {"Petit-déjeuner": "...", "Déjeuner": "...", "Collation": "...", "Dîner": "..."}
}`

    let planData = null
    let genError = null

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }]
        })
      })
      const aiData = await response.json()
      const rawText = aiData.content?.[0]?.text || ''
      // Extraire le JSON proprement
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (jsonMatch) planData = JSON.parse(jsonMatch[0])
    } catch (e) {
      genError = e
      console.error('AI generation error:', e)
    }

    // Fallback si l'IA échoue
    if (!planData) {
      planData = buildFallbackPlan(h, needs)
    }

    const { data } = await supabase.from('plans').insert({
      client_id: id,
      titre: `Plan IA — ${GOAL_ADJUSTMENTS[client.goal]?.label || 'équilibré'}`,
      data: planData,
      calories_cible: needs.target,
      proteines: needs.proteins,
      glucides: needs.carbs,
      lipides: needs.fats
    }).select().single()
    if (data) setPlan(data)
    setGenLoading(false)
  }

  // Plan de secours si l'API est indisponible
  function buildFallbackPlan(h, needs) {
    const avoidSugar = h.aliments_exces?.includes('Sucre / sucreries')
    const skipBreakfast = h.repas_sautes?.includes('Petit-déjeuner')
    return {
      'Lundi': {
        'Petit-déjeuner': skipBreakfast ? 'Smoothie rapide : banane + lait végétal + flocons d\'avoine (5 min)' : avoidSugar ? 'Yaourt grec nature + fruits rouges + graines de chia' : 'Flocons d\'avoine (60g) + lait + 1 fruit',
        'Déjeuner': 'Poulet grillé (150g) + quinoa (80g) + légumes verts + filet d\'huile d\'olive',
        'Collation': avoidSugar ? 'Amandes (15g) + 1 pomme' : 'Yaourt nature 0% + 1 fruit',
        'Dîner': 'Filet de saumon (150g) + haricots verts + patate douce (100g)'
      },
      'Mardi': {
        'Petit-déjeuner': '2 œufs brouillés + pain complet (1 tranche) + café sans sucre',
        'Déjeuner': 'Salade composée : lentilles (80g) + légumes + vinaigrette légère',
        'Collation': 'Fromage blanc 0% + fruits frais',
        'Dîner': 'Cabillaud vapeur (150g) + brocolis + riz complet (60g)'
      },
      'Mercredi': {
        'Petit-déjeuner': 'Pain complet (2 tranches) + avocat (½) + œuf poché',
        'Déjeuner': 'Wok de dinde (130g) + légumes colorés + nouilles soba',
        'Collation': 'Carotte + houmous maison (30g)',
        'Dîner': 'Soupe de légumes maison + galette de sarrasin jambon-fromage frais'
      },
      'Jeudi': {
        'Petit-déjeuner': 'Smoothie vert : épinards + banane + lait végétal + graines de lin',
        'Déjeuner': 'Salade niçoise : thon (100g) + œuf + haricots verts + olives',
        'Collation': '1 poignée de noix de cajou + 1 kiwi',
        'Dîner': 'Omelette aux épinards (3 œufs) + salade verte + pain complet'
      },
      'Vendredi': {
        'Petit-déjeuner': 'Yaourt grec + granola maison (sans sucre ajouté) + myrtilles',
        'Déjeuner': 'Poulet rôti (150g) + patate douce rôtie + salade de roquette',
        'Collation': '1 fruit + 2 carrés de chocolat noir 70%',
        'Dîner': 'Velouté de courgette + toasts ricotta-tomates cerises'
      },
      'Samedi': {
        'Petit-déjeuner': 'Pancakes à l\'avoine (sans sucre) + fruits frais + yaourt',
        'Déjeuner': 'Pavé de bœuf (130g) + légumes grillés + pommes de terre vapeur',
        'Collation': 'Bol de fruits frais de saison',
        'Dîner': 'Buddha bowl : riz + pois chiches + avocat + légumes + tahini'
      },
      'Dimanche': {
        'Petit-déjeuner': 'Brunch léger : œufs brouillés + saumon fumé + pain complet + avocat',
        'Déjeuner': 'Repas convivial : volaille rôtie + légumes + petite portion féculents',
        'Collation': '—',
        'Dîner': 'Soupe maison + fromage blanc + compote pomme sans sucre ajouté'
      }
    }
  }

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',flex:1,color:'var(--gray-400)'}}>Chargement…</div>
  if (!client) return <div style={{padding:24,color:'var(--gray-400)'}}>Client introuvable.</div>

  const needs = calcNeeds({
    weight: client.weight, height: client.height,
    age: client.age, sex: client.sex,
    activity: client.activity, goal: client.goal
  })
  const imc = needs.imc
  const imcCat = imcCategory(imc)
  const name = client.profiles?.full_name || '—'
  const lastPesee = pesees.length > 0 ? pesees[pesees.length - 1].poids : client.weight
  const premierePesee = pesees.length > 0 ? pesees[0].poids : client.weight
  const delta = (lastPesee - premierePesee).toFixed(1)
  const progress = client.weight_target
    ? Math.round(((premierePesee - lastPesee) / (premierePesee - client.weight_target)) * 100)
    : null

  const chartData = pesees.map(p => ({
    date: format(parseISO(p.date), 'd MMM', { locale: fr }),
    poids: p.poids
  }))

  return (
    <>
      <div className="topbar">
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/clients')}>← Retour</button>
          <div className={`avatar av-md ${avatarColor(name)}`}>{getInitials(name)}</div>
          <div>
            <div className="topbar-title">{name}</div>
            <div style={{fontSize:11,color:'var(--gray-400)'}}>{client.profiles?.email}</div>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-sm" onClick={() => setEditingClient(true)}>Modifier le dossier</button>
        </div>
      </div>
      <div className="page-content fade-in">
        <div className="tabs">
          {['bilan','plan','suivi'].map(t => (
            <button key={t} className={`tab-btn${tab===t?' active':''}`} onClick={() => setTab(t)}>
              {t==='bilan'?'Bilan & Macros':t==='plan'?'Plan alimentaire':'Suivi du poids'}
            </button>
          ))}
        </div>

        {/* ── BILAN ── */}
        {tab === 'bilan' && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div className="card">
              <div style={{fontWeight:500,marginBottom:14}}>Données client</div>
              <div className="result-rows">
                <div className="result-row"><span className="result-row-label">Âge</span><span className="result-row-val">{client.age} ans</span></div>
                <div className="result-row"><span className="result-row-label">Sexe</span><span className="result-row-val">{client.sex === 'F' ? 'Femme' : 'Homme'}</span></div>
                <div className="result-row"><span className="result-row-label">Taille</span><span className="result-row-val">{client.height} cm</span></div>
                <div className="result-row"><span className="result-row-label">Poids actuel</span><span className="result-row-val">{client.weight} kg</span></div>
                <div className="result-row"><span className="result-row-label">Poids cible</span><span className="result-row-val">{client.weight_target ? `${client.weight_target} kg` : '—'}</span></div>
                <div className="result-row"><span className="result-row-label">IMC</span><span className="result-row-val">{imc} <span style={{fontSize:11,color:imcCat.color}}>({imcCat.label})</span></span></div>
                <div className="result-row"><span className="result-row-label">Activité</span><span className="result-row-val">{ACTIVITY_FACTORS[client.activity]?.label}</span></div>
                <div className="result-row"><span className="result-row-label">Objectif</span><span className="result-row-val">{client.objectif_label}</span></div>
              </div>
              {client.notes && (
                <div style={{marginTop:12,padding:'10px 12px',background:'var(--amber-light)',borderRadius:'var(--radius-sm)',fontSize:12,color:'#633806'}}>
                  📋 {client.notes}
                </div>
              )}
            </div>
            <div className="card">
              <div style={{fontWeight:500,marginBottom:14}}>Besoins calculés <span style={{fontSize:11,color:'var(--gray-400)',fontWeight:400}}>(Harris-Benedict)</span></div>
              <div className="result-rows" style={{marginBottom:16}}>
                <div className="result-row"><span className="result-row-label">Métabolisme de base</span><span className="result-row-val">{needs.bmr} kcal</span></div>
                <div className="result-row"><span className="result-row-label">TDEE</span><span className="result-row-val">{needs.tdee} kcal</span></div>
                <div className="result-row"><span className="result-row-label">Cible calorique</span><span className="result-row-val accent">{needs.target} kcal</span></div>
                <div className="result-row"><span className="result-row-label">Protéines</span><span className="result-row-val">{needs.proteins} g</span></div>
                <div className="result-row"><span className="result-row-label">Glucides</span><span className="result-row-val">{needs.carbs} g</span></div>
                <div className="result-row"><span className="result-row-label">Lipides</span><span className="result-row-val">{needs.fats} g</span></div>
              </div>
              <div style={{fontWeight:500,fontSize:13,marginBottom:10}}>Répartition macros</div>
              {[
                { label: 'Protéines', g: needs.proteins, kcal: needs.proteins * 4, color: '#1D9E75' },
                { label: 'Glucides', g: needs.carbs, kcal: needs.carbs * 4, color: '#534AB7' },
                { label: 'Lipides', g: needs.fats, kcal: needs.fats * 9, color: '#EF9F27' }
              ].map(m => {
                const pct = Math.round((m.kcal / needs.target) * 100)
                return (
                  <div key={m.label} className="macro-bar-row">
                    <div className="macro-bar-label">{m.label}</div>
                    <div className="macro-bar-track">
                      <div className="macro-bar-fill" style={{ width: `${pct}%`, background: m.color }} />
                    </div>
                    <div className="macro-bar-pct">{pct}%</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Habitudes alimentaires ── */}
          {client.habitudes && (() => {
            const h = client.habitudes
            const hasAny = h.aliments_exces?.length || h.repas_sautes?.length || h.comportements?.length || h.rythme_vie?.length || h.intolerances || h.aliments_aimes
            if (!hasAny) return null
            return (
              <div className="card">
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                  <div style={{fontWeight:500}}>Habitudes & profil comportemental</div>
                  <span style={{fontSize:11,color:'var(--gray-400)',fontStyle:'italic'}}>Utilisé par l'IA pour personnaliser le plan</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
                  {h.aliments_exces?.length > 0 && (
                    <div>
                      <div style={{fontSize:11,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--coral)',marginBottom:7}}>⚠ Excès à réduire</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                        {h.aliments_exces.map(a => <span key={a} style={{fontSize:11,padding:'3px 8px',borderRadius:12,background:'var(--coral-light)',color:'#712B13'}}>{a}</span>)}
                      </div>
                    </div>
                  )}
                  {h.comportements?.length > 0 && (
                    <div>
                      <div style={{fontSize:11,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--amber)',marginBottom:7}}>● Comportements</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                        {h.comportements.map(c => <span key={c} style={{fontSize:11,padding:'3px 8px',borderRadius:12,background:'var(--amber-light)',color:'#633806'}}>{c}</span>)}
                      </div>
                    </div>
                  )}
                  {h.repas_sautes?.length > 0 && (
                    <div>
                      <div style={{fontSize:11,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--purple)',marginBottom:7}}>⊘ Repas sautés</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                        {h.repas_sautes.map(r => <span key={r} style={{fontSize:11,padding:'3px 8px',borderRadius:12,background:'var(--purple-light)',color:'#3C3489'}}>{r}</span>)}
                      </div>
                    </div>
                  )}
                  {h.rythme_vie?.length > 0 && (
                    <div>
                      <div style={{fontSize:11,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--gray-600)',marginBottom:7}}>◷ Rythme de vie</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                        {h.rythme_vie.map(r => <span key={r} style={{fontSize:11,padding:'3px 8px',borderRadius:12,background:'var(--gray-100)',color:'var(--gray-600)'}}>{r}</span>)}
                      </div>
                    </div>
                  )}
                  {h.intolerances && (
                    <div>
                      <div style={{fontSize:11,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--red)',marginBottom:7}}>✕ Intolérances / éviter</div>
                      <div style={{fontSize:12,color:'var(--gray-900)',lineHeight:1.5}}>{h.intolerances}</div>
                    </div>
                  )}
                  {h.aliments_aimes && (
                    <div>
                      <div style={{fontSize:11,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--green-dark)',marginBottom:7}}>✓ Appréciés / favoris</div>
                      <div style={{fontSize:12,color:'var(--gray-900)',lineHeight:1.5}}>{h.aliments_aimes}</div>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
          </div>
        )}

        {/* ── PLAN ── */}
        {tab === 'plan' && (
          <div>
            {!plan ? (
              <div className="card" style={{textAlign:'center',padding:'40px 20px'}}>
                <div style={{fontSize:15,marginBottom:8,color:'var(--gray-600)'}}>Aucun plan alimentaire créé</div>
                <div style={{fontSize:13,color:'var(--gray-400)',marginBottom:8}}>
                  Cible : {needs.target} kcal/jour · {needs.proteins}g prot · {needs.carbs}g glu · {needs.fats}g lip
                </div>
                {client.habitudes && (Object.values(client.habitudes).some(v => v?.length > 0)) && (
                  <div style={{fontSize:12,color:'var(--green-dark)',background:'var(--green-light)',
                    padding:'7px 14px',borderRadius:20,display:'inline-block',marginBottom:16}}>
                    ✦ L'IA va adapter le plan aux habitudes de {name.split(' ')[0]}
                  </div>
                )}
                <div style={{marginTop:8}}>
                  <button className="btn btn-primary" onClick={generatePlan} disabled={genLoading}>
                    {genLoading
                      ? <span style={{display:'flex',alignItems:'center',gap:8}}>
                          <svg width="14" height="14" viewBox="0 0 14 14" style={{animation:'spin 1s linear infinite'}}><circle cx="7" cy="7" r="5" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/><path d="M7 2a5 5 0 015 5" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                          Génération IA en cours…
                        </span>
                      : '✦ Générer le plan avec l\'IA'}
                  </button>
                </div>
                <div style={{fontSize:11,color:'var(--gray-400)',marginTop:10}}>Environ 15-20 secondes</div>
              </div>
            ) : (
              <div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                  <div>
                    <div style={{fontWeight:500,fontSize:15}}>{plan.titre}</div>
                    <div style={{fontSize:12,color:'var(--gray-400)',marginTop:2}}>
                      {plan.calories_cible} kcal · {plan.proteines}g prot · {plan.glucides}g glu · {plan.lipides}g lip
                    </div>
                  </div>
                  <button className="btn btn-sm" onClick={generatePlan} disabled={genLoading}>
                    {genLoading ? '…' : '↺ Regénérer'}
                  </button>
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
            )}
          </div>
        )}

        {/* ── SUIVI POIDS ── */}
        {tab === 'suivi' && (
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
              <div className="metric-card">
                <div className="metric-label">Poids initial</div>
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
                <div className="metric-value" style={{color: parseFloat(delta) < 0 ? 'var(--green)' : parseFloat(delta) > 0 ? 'var(--red)' : undefined}}>
                  {parseFloat(delta) > 0 ? '+' : ''}{delta}
                </div>
                <div className="metric-sub">kg depuis début</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Objectif</div>
                <div className="metric-value">{client.weight_target || '—'}</div>
                <div className="metric-sub">{progress !== null ? `${Math.min(100, Math.max(0, progress))}% atteint` : 'Non défini'}</div>
              </div>
            </div>

            {chartData.length > 1 ? (
              <div className="card" style={{marginBottom:16}}>
                <div style={{fontWeight:500,marginBottom:14}}>Courbe de poids</div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{top:5,right:20,left:0,bottom:5}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                    <XAxis dataKey="date" tick={{fontSize:11,fill:'var(--gray-400)'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize:11,fill:'var(--gray-400)'}} axisLine={false} tickLine={false} domain={['auto','auto']} />
                    <Tooltip contentStyle={{fontSize:12,borderRadius:8,border:'1px solid var(--gray-200)'}} />
                    {client.weight_target && (
                      <ReferenceLine y={client.weight_target} stroke="var(--green)" strokeDasharray="4 4" label={{value:'Objectif',fontSize:10,fill:'var(--green-dark)'}} />
                    )}
                    <Line type="monotone" dataKey="poids" stroke="var(--green)" strokeWidth={2} dot={{ r: 4, fill: 'var(--green)' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="card" style={{marginBottom:16,textAlign:'center',padding:'30px',color:'var(--gray-400)',fontSize:13}}>
                Ajoutez au moins 2 pesées pour afficher la courbe.
              </div>
            )}

            <div className="card">
              <div style={{fontWeight:500,marginBottom:12}}>Ajouter une pesée</div>
              <div style={{display:'flex',gap:10,alignItems:'flex-end'}}>
                <div className="form-group" style={{flex:1}}>
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
                </div>
                <div className="form-group" style={{flex:1}}>
                  <label className="form-label">Poids (kg)</label>
                  <input className="form-input" type="number" step="0.1" placeholder="ex : 67.5" value={newPoids} onChange={e => setNewPoids(e.target.value)} />
                </div>
                <button className="btn btn-primary" style={{marginBottom:0}} onClick={addPesee} disabled={savingPesee || !newPoids}>
                  {savingPesee ? '…' : 'Ajouter'}
                </button>
              </div>
              {pesees.length > 0 && (
                <div style={{marginTop:14}}>
                  <div style={{fontSize:12,color:'var(--gray-400)',marginBottom:8}}>Historique</div>
                  <div style={{maxHeight:180,overflowY:'auto'}}>
                    <table className="data-table">
                      <thead><tr><th>Date</th><th>Poids</th><th>Variation</th></tr></thead>
                      <tbody>
                        {[...pesees].reverse().map((p, i, arr) => {
                          const prev = arr[i + 1]
                          const diff = prev ? (p.poids - prev.poids).toFixed(1) : null
                          return (
                            <tr key={p.id}>
                              <td>{format(parseISO(p.date), 'd MMMM yyyy', { locale: fr })}</td>
                              <td style={{fontWeight:500}}>{p.poids} kg</td>
                              <td style={{color: diff === null ? undefined : parseFloat(diff) < 0 ? 'var(--green)' : parseFloat(diff) > 0 ? 'var(--red)' : undefined}}>
                                {diff !== null ? (parseFloat(diff) > 0 ? '+' : '') + diff + ' kg' : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL EDIT ── */}
      {editingClient && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditingClient(false)}>
          <div className="modal fade-in">
            <div className="modal-title">Modifier le dossier — {name}</div>
            <form onSubmit={saveClientEdit}>
              <div className="form-grid-3" style={{marginBottom:10}}>
                <div className="form-group"><label className="form-label">Âge</label><input className="form-input" type="number" value={editForm.age} onChange={e => setEditForm(f=>({...f,age:e.target.value}))} /></div>
                <div className="form-group"><label className="form-label">Sexe</label><select className="form-select" value={editForm.sex} onChange={e => setEditForm(f=>({...f,sex:e.target.value}))}><option value="F">Femme</option><option value="M">Homme</option></select></div>
                <div className="form-group"><label className="form-label">Taille (cm)</label><input className="form-input" type="number" value={editForm.height} onChange={e => setEditForm(f=>({...f,height:e.target.value}))} /></div>
                <div className="form-group"><label className="form-label">Poids actuel (kg)</label><input className="form-input" type="number" step="0.1" value={editForm.weight} onChange={e => setEditForm(f=>({...f,weight:e.target.value}))} /></div>
                <div className="form-group"><label className="form-label">Poids cible (kg)</label><input className="form-input" type="number" step="0.1" value={editForm.weight_target||''} onChange={e => setEditForm(f=>({...f,weight_target:e.target.value}))} /></div>
                <div className="form-group"><label className="form-label">Statut</label><select className="form-select" value={editForm.statut} onChange={e => setEditForm(f=>({...f,statut:e.target.value}))}><option value="nouveau">Nouveau</option><option value="actif">Actif</option><option value="maintien">Maintien</option><option value="alerte">À relancer</option><option value="termine">Terminé</option></select></div>
              </div>
              <div className="form-group" style={{marginBottom:10}}><label className="form-label">Activité</label><select className="form-select" value={editForm.activity} onChange={e => setEditForm(f=>({...f,activity:e.target.value}))}>{Object.entries(ACTIVITY_FACTORS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
              <div className="form-group" style={{marginBottom:10}}><label className="form-label">Objectif</label><select className="form-select" value={editForm.goal} onChange={e => setEditForm(f=>({...f,goal:e.target.value}))}>{Object.entries(GOAL_ADJUSTMENTS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Notes internes</label><textarea className="form-textarea" value={editForm.notes} onChange={e => setEditForm(f=>({...f,notes:e.target.value}))} placeholder="Allergies, observations…" /></div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setEditingClient(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Sauvegarde…' : 'Enregistrer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

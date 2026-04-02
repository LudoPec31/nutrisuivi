import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) setError('Email ou mot de passe incorrect.')
    else navigate('/')
  }

  return (
    <div className="auth-page">
      <div className="auth-card fade-in">
        <div className="auth-logo">NutriSuivi</div>
        <div className="auth-sub">Accédez à votre espace nutrition</div>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:14}}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="vous@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Mot de passe</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{marginTop:4}}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
        <div style={{marginTop:20,fontSize:12,color:'var(--gray-400)',textAlign:'center',lineHeight:1.6}}>
          Votre compte est créé par votre nutritionniste.<br/>
          Contactez Aurélie pour accéder à votre espace.
        </div>
      </div>
    </div>
  )
}

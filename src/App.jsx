import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCircle2,
  ChevronDown, Clock3, Compass, Heart, Leaf, LogOut, MapPin, Menu, Plus, Search, Sparkles,
  Sprout, Users, X,
} from 'lucide-react'
import { api } from './api'

const categories = ['All opportunities', 'Environment', 'Food access', 'Education', 'Community', 'Animal welfare']
const categoryIcon = { Environment: Leaf, 'Food access': Heart, Education: Sparkles, Community: Users, 'Animal welfare': Heart }
const categoryTint = { Environment: 'mint', 'Food access': 'peach', Education: 'lavender', Community: 'butter', 'Animal welfare': 'rose' }

function formatDate(value, options = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return new Date(value).toLocaleDateString(undefined, options)
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function App() {
  const [user, setUser] = useState(null)
  const [events, setEvents] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [stats, setStats] = useState({ hours: 0, upcoming: 0, completed: 0 })
  const [view, setView] = useState('discover')
  const [query, setQuery] = useState('')
  const [city, setCity] = useState('')
  const [category, setCategory] = useState('All opportunities')
  const [modal, setModal] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)

  const refreshEvents = useCallback(async () => {
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (city.trim()) params.set('city', city.trim())
    if (category !== 'All opportunities') params.set('category', category)
    const data = await api(`/events${params.size ? `?${params}` : ''}`)
    setEvents(data)
  }, [query, city, category])

  const refreshAccount = useCallback(async (account = user) => {
    if (!account) {
      setRegistrations([])
      setStats({ hours: 0, upcoming: 0, completed: 0 })
      return
    }
    if (account.role === 'VOLUNTEER') {
      const [myRegistrations, myStats] = await Promise.all([api('/me/registrations'), api('/me/stats')])
      setRegistrations(myRegistrations)
      setStats(myStats)
    }
  }, [user])

  useEffect(() => {
    refreshEvents().catch(error => setToast(error.message))
  }, [refreshEvents])

  useEffect(() => {
    api('/me').then(account => setUser(account)).catch(() => setUser(null))
  }, [])

  useEffect(() => {
    const handler = () => setUser(null)
    window.addEventListener('neighborly:unauthorized', handler)
    return () => window.removeEventListener('neighborly:unauthorized', handler)
  }, [])

  useEffect(() => {
    if (user) refreshAccount(user).catch(error => setToast(error.message))
  }, [user, refreshAccount])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const registeredIds = useMemo(
    () => new Set(registrations.filter(item => item.status === 'REGISTERED').map(item => item.event.id)),
    [registrations],
  )

  async function handleAuth(payload, mode) {
    setBusy(true)
    try {
      if (mode === 'register') await api('/auth/register', { method: 'POST', body: JSON.stringify(payload) })
      const account = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: payload.email, password: payload.password }),
      })
      setUser(account)
      setModal(null)
      setToast(`Welcome${account.name ? `, ${account.name.split(' ')[0]}` : ''}!`)
      if (modal?.returnEvent && account.role === 'VOLUNTEER') {
        await api(`/events/${modal.returnEvent.id}/registrations`, { method: 'POST' })
        await Promise.all([refreshEvents(), refreshAccount(account)])
        setToast('You’re on the list! See you there.')
      }
    } catch (error) {
      setToast(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' })
      setUser(null)
      setView('discover')
      setToast('You’ve been signed out.')
    } catch (error) {
      setToast(error.message)
    }
  }

  async function registerForEvent(event) {
    if (!user) {
      setModal({ type: 'auth', mode: 'register', returnEvent: event })
      return
    }
    setBusy(true)
    try {
      await api(`/events/${event.id}/registrations`, { method: 'POST' })
      await Promise.all([refreshEvents(), refreshAccount(user)])
      setSelectedEvent(null)
      setToast('You’re on the list! See you there.')
    } catch (error) {
      setToast(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function cancelRegistration(eventId) {
    try {
      await api(`/events/${eventId}/registrations`, { method: 'DELETE' })
      await Promise.all([refreshEvents(), refreshAccount(user)])
      setToast('Your spot has been released.')
    } catch (error) {
      setToast(error.message)
    }
  }

  async function openAccountView(nextView) {
    if (!user) {
      setView(nextView)
      setMobileMenu(false)
      return
    }
    setView(nextView)
    setMobileMenu(false)
    if (nextView === 'organize' && user.role === 'ORGANIZER') {
      try {
        setEvents(await api('/organizer/events'))
      } catch (error) {
        setToast(error.message)
      }
    } else if (nextView === 'activity') {
      refreshAccount(user).catch(error => setToast(error.message))
    }
  }

  function openAuth(mode) {
    setModal({ type: 'auth', mode })
    setMobileMenu(false)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => { setView('discover'); refreshEvents() }} aria-label="Neighborly home">
          <span className="brand-mark"><Sprout size={20} strokeWidth={2.4} /></span>
          <span>neighborly<span className="brand-period">.</span></span>
        </button>
        <nav className={`main-nav ${mobileMenu ? 'nav-open' : ''}`}>
          <button className={view === 'discover' ? 'nav-link active' : 'nav-link'} onClick={() => { setView('discover'); refreshEvents(); setMobileMenu(false) }}>
            Explore
          </button>
          <button className={view === 'activity' ? 'nav-link active' : 'nav-link'} onClick={() => openAccountView('activity')}>
            My activity
          </button>
          <button className={view === 'organize' ? 'nav-link active' : 'nav-link'} onClick={() => openAccountView('organize')}>
            For organizations
          </button>
        </nav>
        <div className="top-actions">
          {user ? (
            <>
              <button className="profile-chip" onClick={() => openAccountView('activity')}>
                <span className="avatar">{user.name?.slice(0, 1).toUpperCase()}</span>
                <span className="profile-name">{user.name?.split(' ')[0]}</span>
                <ChevronDown size={15} />
              </button>
              <button className="icon-button signout" aria-label="Sign out" onClick={logout}><LogOut size={17} /></button>
            </>
          ) : (
            <>
              <button className="text-button signin" onClick={() => openAuth('login')}>Log in</button>
              <button className="button button-dark button-small" onClick={() => openAuth('register')}>Join the community <ArrowRight size={15} /></button>
            </>
          )}
          <button className="icon-button mobile-toggle" aria-label="Open menu" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X size={21} /> : <Menu size={21} />}</button>
        </div>
      </header>

      {view === 'discover' && (
        <main>
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-dot" /> SMALL ACTS. BIG RIPPLE EFFECTS.</div>
              <h1>Good things<br />happen <span>together.</span></h1>
              <p className="hero-description">Find your people. Lend a hand. Make your corner of the world a little brighter.</p>
              <div className="hero-buttons">
                <a href="#opportunities" className="button button-dark">Find your next good thing <ArrowDownRight size={17} /></a>
                <button className="button button-quiet" onClick={() => openAccountView('organize')}>I’m an organization <ArrowUpRight size={16} /></button>
              </div>
              <div className="hero-social">
                <div className="avatar-stack"><span className="stack-a">M</span><span className="stack-b">J</span><span className="stack-c">A</span><span className="stack-d"><Heart size={13} fill="currentColor" /></span></div>
                <span>Good people, doing good things <b>in your neighborhood.</b></span>
              </div>
            </div>
            <div className="hero-art">
              <div className="sun-shape" />
              <div className="art-note note-top"><Sparkles size={15} /> your time matters</div>
              <div className="art-figure figure-one"><span className="person-head" /><span className="person-body" /><span className="person-arm" /></div>
              <div className="art-figure figure-two"><span className="person-head" /><span className="person-body" /><span className="person-arm" /></div>
              <div className="art-figure figure-three"><span className="person-head" /><span className="person-body" /><span className="person-arm" /></div>
              <div className="art-ground" />
              <div className="art-plant plant-one"><i /><i /><i /></div>
              <div className="art-plant plant-two"><i /><i /><i /></div>
              <div className="art-note note-bottom"><span className="note-check"><Check size={12} /></span> a little goes a long way</div>
              <span className="art-spark spark-one">✳</span><span className="art-spark spark-two">✳</span>
            </div>
          </section>

          <section className="trust-strip">
            <span>SHOW UP FOR WHAT MATTERS</span><i /><span>MEET YOUR NEIGHBORS</span><i /><span>MAKE A REAL DIFFERENCE</span>
          </section>

          <section className="opportunities section-wrap" id="opportunities">
            <div className="section-heading">
              <div>
                <div className="eyebrow eyebrow-muted">A GOOD PLACE TO START</div>
                <h2>Find your kind of <span>good.</span></h2>
                <p>Small moments of showing up can make a big difference.</p>
              </div>
              <button className="location-pill" onClick={() => document.getElementById('city-search')?.focus()}><MapPin size={16} /> {city || 'Everywhere'} <ChevronDown size={14} /></button>
            </div>

            <div className="search-row">
              <label className="search-box"><Search size={19} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Try “planting”, “kids”, “food pantry”..." aria-label="Search opportunities" /><kbd>⌘ K</kbd></label>
              <label className="city-box"><MapPin size={17} /><input id="city-search" value={city} onChange={event => setCity(event.target.value)} placeholder="City or ZIP" aria-label="Filter by city" /></label>
              <button className="button button-dark search-submit" onClick={() => refreshEvents().catch(error => setToast(error.message))}>Find opportunities <ArrowRight size={16} /></button>
            </div>

            <div className="category-row" role="tablist" aria-label="Opportunity categories">
              {categories.map((item, index) => (
                <button key={item} className={`category-tab ${category === item ? 'selected' : ''}`} onClick={() => setCategory(item)} role="tab" aria-selected={category === item}>
                  {index === 0 ? <Compass size={15} /> : (() => { const Icon = categoryIcon[item] || Heart; return <Icon size={15} /> })()} {item}
                </button>
              ))}
            </div>

            <div className="results-meta"><span><b>{events.length}</b> {events.length === 1 ? 'opportunity' : 'opportunities'} to show up for</span><button className="sort-button">Soonest first <ChevronDown size={14} /></button></div>
            {events.length ? (
              <div className="event-grid">
                {events.map((event, index) => <EventCard key={event.id} event={event} index={index} registered={registeredIds.has(event.id)} onOpen={() => setSelectedEvent(event)} onRegister={() => registerForEvent(event)} />)}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-icon"><Sprout size={25} /></span>
                <h3>No opportunities just yet</h3>
                <p>Try a different search, or be the first organization to post something wonderful.</p>
                <button className="button button-dark" onClick={() => openAccountView('organize')}>Post an opportunity <ArrowRight size={16} /></button>
              </div>
            )}
            <div className="below-grid">
              <div className="impact-note"><span className="impact-icon"><Heart size={17} /></span><span><b>One hour can change someone’s day.</b><br />And it just might change yours, too.</span></div>
              <button className="button button-outline" onClick={() => openAccountView('organize')}>Have an opportunity to share? <ArrowRight size={16} /></button>
            </div>
          </section>
        </main>
      )}

      {view === 'activity' && <ActivityView user={user} registrations={registrations} stats={stats} onExplore={() => setView('discover')} onCancel={cancelRegistration} onProfile={profile => setModal({ type: 'profile', profile })} />}
      {view === 'organize' && <OrganizerView user={user} events={events} busy={busy} setBusy={setBusy} setEvents={setEvents} setToast={setToast} onCreate={() => setModal({ type: 'event' })} />}

      <footer className="footer"><button className="brand footer-brand" onClick={() => setView('discover')}><span className="brand-mark"><Sprout size={18} /></span><span>neighborly<span className="brand-period">.</span></span></button><span>Made for the good we can do together.</span><span>© 2025 Neighborly</span></footer>

      {selectedEvent && <EventModal event={selectedEvent} registered={registeredIds.has(selectedEvent.id)} user={user} busy={busy} onClose={() => setSelectedEvent(null)} onRegister={() => registerForEvent(selectedEvent)} onCancel={() => cancelRegistration(selectedEvent.id)} />}
      {modal?.type === 'auth' && <AuthModal mode={modal.mode} initialRole={modal.defaultRole} busy={busy} onClose={() => setModal(null)} onModeChange={mode => setModal({ ...modal, mode })} onSubmit={handleAuth} />}
      {modal?.type === 'event' && <EventFormModal onClose={() => setModal(null)} onSave={async data => {
        setBusy(true)
        try {
          await api('/events', { method: 'POST', body: JSON.stringify(data) })
          const list = await api('/organizer/events')
          setEvents(list)
          setModal(null)
          setView('organize')
          setToast('Your opportunity is live. Thanks for bringing people together!')
        } catch (error) { setToast(error.message) } finally { setBusy(false) }
      }} busy={busy} />}
      {modal?.type === 'profile' && <ProfileModal profile={modal.profile} onClose={() => setModal(null)} onSave={async data => {
        try {
          const updated = await api('/me', { method: 'PUT', body: JSON.stringify(data) })
          setUser(updated)
          setModal(null)
          setToast('Your profile is looking good.')
        } catch (error) { setToast(error.message) }
      }} />}
      {toast && <div className="toast" role="status"><CheckCircle2 size={18} /> {toast}<button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={16} /></button></div>}
    </div>
  )
}

function EventCard({ event, index, registered, onOpen, onRegister }) {
  const tint = categoryTint[event.category] || ['mint', 'peach', 'lavender', 'butter'][index % 4]
  const Icon = categoryIcon[event.category] || Sprout
  const remaining = Math.max(0, event.capacity - event.registeredCount)
  return (
    <article className={`event-card card-${tint}`}>
      <button className="card-open" onClick={onOpen} aria-label={`View ${event.title}`}>
        <div className="card-image">
          <div className={`illustration illustration-${index % 4}`}><span className="illustration-sun" /><span className="illustration-hill hill-back" /><span className="illustration-hill hill-front" /><span className="illustration-person p1" /><span className="illustration-person p2" /><span className="illustration-detail">✳</span></div>
          <span className="category-label"><Icon size={13} /> {event.category}</span>
          <span className="card-date">{formatDate(event.startsAt)}</span>
        </div>
        <div className="card-content">
          <h3>{event.title}</h3>
          <p className="card-description">{event.description}</p>
          <div className="card-details"><span><MapPin size={14} /> {event.city}</span><span><Clock3 size={14} /> {event.durationHours} hours</span></div>
          <div className="card-org"><span className="org-avatar">{(event.organizerOrganization || event.organizerName || 'N').slice(0, 1)}</span><span>{event.organizerOrganization || event.organizerName}</span><span className="card-spots">{remaining === 0 ? 'Full' : `${remaining} spots left`}</span></div>
        </div>
      </button>
      <button className={registered ? 'card-join joined' : 'card-join'} onClick={registered ? onOpen : onRegister} disabled={!registered && remaining === 0}>
        {registered ? <><Check size={15} /> You’re going</> : remaining === 0 ? 'Fully booked' : <>I’m in <ArrowRight size={15} /></>}
      </button>
    </article>
  )
}

function EventModal({ event, registered, user, busy, onClose, onRegister, onCancel }) {
  const remaining = Math.max(0, event.capacity - event.registeredCount)
  return (
    <div className="modal-backdrop" onMouseDown={eventObject => { if (eventObject.target === eventObject.currentTarget) onClose() }}>
      <section className="dialog event-dialog" role="dialog" aria-modal="true" aria-labelledby="event-title">
        <button className="dialog-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <div className={`dialog-art card-${categoryTint[event.category] || 'mint'}`}><span className="dialog-art-label">{event.category}</span><div className="illustration illustration-1"><span className="illustration-sun" /><span className="illustration-hill hill-back" /><span className="illustration-hill hill-front" /><span className="illustration-person p1" /><span className="illustration-person p2" /></div></div>
        <div className="event-dialog-content">
          <div className="eyebrow eyebrow-muted">A GOOD THING IS HAPPENING</div>
          <h2 id="event-title">{event.title}</h2>
          <p className="dialog-description">{event.description}</p>
          <div className="event-facts"><span><CalendarDays size={17} /> {formatDate(event.startsAt, { weekday: 'long', month: 'long', day: 'numeric' })}<br /><small>{formatTime(event.startsAt)}</small></span><span><MapPin size={17} /> {event.location}<br /><small>{event.city}</small></span><span><Clock3 size={17} /> {event.durationHours} hours<br /><small>Time well spent</small></span></div>
          <div className="dialog-host"><div className="host-mark"><Sprout size={18} /></div><div><small>HOSTED BY</small><b>{event.organizerOrganization || event.organizerName}</b></div><div className="host-spots"><b>{remaining}</b><small>spots left</small></div></div>
          <button className={registered ? 'button button-outline full-button' : 'button button-dark full-button'} disabled={busy || (!registered && !remaining)} onClick={registered ? onCancel : onRegister}>
            {busy ? 'One moment...' : registered ? 'Release my spot' : user ? 'Count me in' : 'Join to volunteer'} {!registered && <ArrowRight size={16} />}
          </button>
          {!registered && <p className="dialog-footnote"><Heart size={13} /> No experience needed. Just you, showing up.</p>}
        </div>
      </section>
    </div>
  )
}

function AuthModal({ mode, initialRole = 'VOLUNTEER', busy, onClose, onModeChange, onSubmit }) {
  const [role, setRole] = useState(initialRole)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    const values = Object.fromEntries(form.entries())
    if (mode === 'register' && values.password !== values.confirmPassword) {
      setError('Those passwords don’t match yet.')
      return
    }
    await onSubmit({ ...values, role }, mode)
  }
  return (
    <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="dialog auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="dialog-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <div className="auth-art"><span className="auth-sun" /><Sprout size={72} strokeWidth={1.15} /><span className="auth-art-copy">There’s a place<br />for you here.</span></div>
        <div className="auth-form-wrap">
          <div className="eyebrow eyebrow-muted">{mode === 'login' ? 'GOOD TO SEE YOU AGAIN' : 'LET’S MAKE GOOD HAPPEN'}</div>
          <h2 id="auth-title">{mode === 'login' ? 'Welcome back.' : 'Come on in.'}</h2>
          <p className="auth-subtitle">{mode === 'login' ? 'Your community saved you a spot.' : 'Your community is better with you in it.'}</p>
          {mode === 'register' && <div className="role-switch"><button className={role === 'VOLUNTEER' ? 'role-option active' : 'role-option'} onClick={() => setRole('VOLUNTEER')} type="button">I want to volunteer</button><button className={role === 'ORGANIZER' ? 'role-option active' : 'role-option'} onClick={() => setRole('ORGANIZER')} type="button">I’m an organization</button></div>}
          <form className="form-stack" onSubmit={submit}>
            {mode === 'register' && <label>Your name<input name="name" autoComplete="name" placeholder="Alex Morgan" required maxLength="120" /></label>}
            {mode === 'register' && role === 'ORGANIZER' && <label>Organization name<input name="organizationName" placeholder="Your community group" required maxLength="120" /></label>}
            <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
            {mode === 'register' && <label>Your city <span className="optional-label">optional</span><input name="city" placeholder="Portland, OR" maxLength="120" /></label>}
            <label>Password<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'} required minLength="8" maxLength="72" /></label>
            {mode === 'register' && <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" placeholder="One more time" required /></label>}
            {error && <p className="form-error">{error}</p>}
            <button className="button button-dark full-button" disabled={busy}>{busy ? 'A little moment...' : mode === 'login' ? 'Log in' : 'Create my account'} <ArrowRight size={16} /></button>
          </form>
          <p className="auth-switch">{mode === 'login' ? 'New around here?' : 'Already part of the neighborhood?'} <button onClick={() => onModeChange(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Join us' : 'Log in'}</button></p>
        </div>
      </section>
    </div>
  )
}

function ActivityView({ user, registrations, stats, onExplore, onCancel, onProfile }) {
  const upcoming = registrations.filter(item => item.status === 'REGISTERED')
  const completed = registrations.filter(item => item.status === 'ATTENDED')
  return (
    <main className="dashboard section-wrap">
      <div className="dashboard-welcome"><div><div className="eyebrow eyebrow-muted">YOUR GOOD THINGS</div><h1>Hey, {user?.name?.split(' ')[0] || 'neighbor'}<span className="wave">.</span></h1><p>Every little bit of showing up adds up.</p></div><button className="button button-outline" onClick={() => onProfile(user)}>Edit my profile <ArrowUpRight size={15} /></button></div>
      <div className="stats-row"><StatCard icon={Clock3} value={stats.hours} label="hours given" color="mint" /><StatCard icon={CalendarDays} value={upcoming.length} label="upcoming" color="peach" /><StatCard icon={Heart} value={completed.length} label="good things done" color="lavender" /></div>
      <section className="dashboard-section"><div className="dashboard-section-title"><div><div className="eyebrow eyebrow-muted">IT’S ON YOUR CALENDAR</div><h2>Coming up</h2></div><button className="text-link" onClick={onExplore}>Find another opportunity <ArrowRight size={15} /></button></div>
        {upcoming.length ? <div className="activity-list">{upcoming.map(item => <ActivityRow key={item.id} item={item} onCancel={onCancel} />)}</div> : <EmptyActivity icon={CalendarDays} title="Nothing on your calendar yet" text="Your next favorite thing is just around the corner." onExplore={onExplore} />}
      </section>
      <section className="dashboard-section completed-section"><div className="dashboard-section-title"><div><div className="eyebrow eyebrow-muted">LOOK AT YOU, MAKING A DIFFERENCE</div><h2>Good things done</h2></div></div>
        {completed.length ? <div className="activity-list">{completed.map(item => <ActivityRow key={item.id} item={item} completed />)}</div> : <div className="completed-empty"><Sparkles size={18} /> Your first volunteer hour will feel good. We promise.</div>}
      </section>
      <div className="profile-nudge"><span className="nudge-icon"><Sparkles size={18} /></span><span><b>Help us find your perfect fit.</b><br />Add your interests to your profile and discover opportunities that feel like you.</span><button onClick={() => onProfile(user)}>Update interests <ArrowRight size={15} /></button></div>
    </main>
  )
}

function StatCard({ icon: Icon, value, label, color }) {
  return <div className={`stat-card stat-${color}`}><span className="stat-icon"><Icon size={19} /></span><strong>{value}</strong><span>{label}</span></div>
}

function ActivityRow({ item, onCancel, completed = false }) {
  const event = item.event
  return <article className="activity-row"><div className={`activity-date card-${categoryTint[event.category] || 'mint'}`}><b>{new Date(event.startsAt).getDate()}</b><span>{new Date(event.startsAt).toLocaleDateString(undefined, { month: 'short' })}</span></div><div className="activity-info"><h3>{event.title}</h3><p><MapPin size={14} /> {event.location}, {event.city} <span /> <Clock3 size={14} /> {completed ? `${item.hoursLogged} hours given` : formatTime(event.startsAt)}</p></div><div className="activity-action">{completed ? <span className="attended-badge"><Check size={14} /> Showed up</span> : <button className="subtle-button" onClick={() => onCancel(event.id)}>Release spot</button>}</div></article>
}

function EmptyActivity({ icon: Icon, title, text, onExplore }) {
  return <div className="empty-activity"><span><Icon size={23} /></span><h3>{title}</h3><p>{text}</p><button className="button button-outline" onClick={onExplore}>Explore opportunities <ArrowRight size={15} /></button></div>
}

function OrganizerView({ user, events, busy, setBusy, setEvents, setToast, onCreate }) {
  const [eventId, setEventId] = useState(null)
  const [attendees, setAttendees] = useState([])
  const [loadingAttendees, setLoadingAttendees] = useState(false)
  const isOrganizer = user?.role === 'ORGANIZER'

  async function loadAttendees(id) {
    setEventId(id)
    setLoadingAttendees(true)
    try { setAttendees(await api(`/events/${id}/participants`)) }
    catch (error) { setToast(error.message) }
    finally { setLoadingAttendees(false) }
  }

  async function markAttendance(registration) {
    try {
      await api(`/events/${eventId}/registrations/${registration.id}/attendance`, {
        method: 'PATCH', body: JSON.stringify({ hours: registration.event.durationHours }),
      })
      setAttendees(await api(`/events/${eventId}/participants`))
      setToast('Attendance saved. Those hours count!')
    } catch (error) { setToast(error.message) }
  }

  async function deleteEvent(event) {
    if (!window.confirm(`Remove "${event.title}"? This also removes its registrations.`)) return
    setBusy(true)
    try {
      await api(`/events/${event.id}`, { method: 'DELETE' })
      setEvents(await api('/organizer/events'))
      setToast('Opportunity removed.')
    } catch (error) { setToast(error.message) }
    finally { setBusy(false) }
  }

  return (
    <main className="dashboard section-wrap organizer-dashboard">
      <div className="dashboard-welcome"><div><div className="eyebrow eyebrow-muted">GOOD THINGS START HERE</div><h1>{isOrganizer ? 'Let’s bring people together.' : 'For the people who make it happen.'}</h1><p>{isOrganizer ? `A little community goes a long way, ${user.name.split(' ')[0]}.` : 'Create an organization account to share opportunities with your community.'}</p></div>{isOrganizer && <button className="button button-dark" onClick={onCreate}><Plus size={17} /> Post an opportunity</button>}</div>
      {!isOrganizer ? <div className="organizer-cta"><div className="organizer-cta-icon"><Sprout size={28} /></div><div><h2>Your next great volunteer starts here.</h2><p>Create a free organization account to post events, manage registrations, and celebrate the hours your volunteers give.</p><button className="button button-dark" onClick={() => setModal({ type: 'auth', mode: 'register', defaultRole: 'ORGANIZER' })}>Create an organization account <ArrowRight size={15} /></button></div></div> :
        <div className="organizer-layout">
          <section className="organizer-events"><div className="dashboard-section-title"><div><div className="eyebrow eyebrow-muted">YOUR COMMUNITY CALENDAR</div><h2>Your opportunities <span className="count-bubble">{events.length}</span></h2></div></div>
            {events.length ? <div className="activity-list">{events.map(event => <article className="organizer-event-row" key={event.id}><div className={`activity-date card-${categoryTint[event.category] || 'mint'}`}><b>{new Date(event.startsAt).getDate()}</b><span>{new Date(event.startsAt).toLocaleDateString(undefined, { month: 'short' })}</span></div><div className="activity-info"><h3>{event.title}</h3><p><MapPin size={14} /> {event.city}<span /><Users size={14} /> {event.registeredCount}/{event.capacity} registered</p></div><div className="event-row-actions"><button className="subtle-button" onClick={() => loadAttendees(event.id)}>Volunteers <ArrowRight size={14} /></button><button className="icon-button delete-event" onClick={() => deleteEvent(event)} aria-label={`Delete ${event.title}`}><X size={16} /></button></div></article>)}</div> : <EmptyActivity icon={Sprout} title="Your first opportunity starts here" text="Post an event and find your people." onExplore={onCreate} />}
          </section>
          <aside className="organizer-aside"><div className="organizer-tip"><span><Sparkles size={17} /></span><div className="eyebrow eyebrow-muted">A LITTLE TIP</div><h3>Clear details make it easy to say yes.</h3><p>Include what volunteers will do, what to bring, and what they can expect. The small stuff helps people feel welcome.</p></div><div className="organizer-number"><b>{events.reduce((sum, event) => sum + event.registeredCount, 0)}</b><span>neighbors signed up</span><Users size={21} /></div></aside>
        </div>}
      {eventId && <div className="attendee-panel"><div className="attendee-heading"><div><div className="eyebrow eyebrow-muted">THE PEOPLE SHOWING UP</div><h2>Volunteer list</h2></div><button className="icon-button" onClick={() => setEventId(null)} aria-label="Close volunteer list"><X size={18} /></button></div>{loadingAttendees ? <p className="loading-copy">Gathering your volunteer list...</p> : attendees.length ? attendees.map(item => <div className="attendee-row" key={item.id}><span className="avatar">{item.volunteer.name.slice(0, 1)}</span><span className="attendee-name"><b>{item.volunteer.name}</b><small>{item.volunteer.email}</small></span>{item.status === 'ATTENDED' ? <span className="attended-badge"><Check size={13} /> {item.hoursLogged}h logged</span> : <button className="button button-outline button-small" onClick={() => markAttendance(item)}>Mark attended</button>}</div>) : <p className="loading-copy">No one has signed up just yet. Good things take time.</p>}</div>}
    </main>
  )
}

function EventFormModal({ onClose, onSave, busy }) {
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const data = Object.fromEntries(form.entries())
    data.capacity = Number(data.capacity)
    data.durationHours = Number(data.durationHours)
    data.startsAt = `${data.startsAt}:00`
    try { await onSave(data) } catch (failure) { setError(failure.message) }
  }
  const minDateTime = new Date(Date.now() - new Date().getTimezoneOffset() * 60000 + 60000).toISOString().slice(0, 16)
  return <div className="modal-backdrop"><section className="dialog form-dialog" role="dialog" aria-modal="true" aria-labelledby="create-title"><button className="dialog-close" onClick={onClose} aria-label="Close"><X size={19} /></button><div className="eyebrow eyebrow-muted">MAKE A GOOD THING HAPPEN</div><h2 id="create-title">Post an opportunity</h2><p className="auth-subtitle">Tell your neighbors how they can help.</p><form className="form-stack event-form" onSubmit={submit}><label>Opportunity title<input name="title" placeholder="e.g. Plant a neighborhood garden" required maxLength="160" /></label><label>What will volunteers do?<textarea name="description" placeholder="Describe the day, what to bring, and what people can expect..." required rows="4" maxLength="3000" /></label><div className="form-grid"><label>Category<select name="category" required defaultValue=""><option value="" disabled>Choose one</option>{categories.slice(1).map(item => <option key={item}>{item}</option>)}</select></label><label>City<input name="city" placeholder="Portland" required maxLength="120" /></label></div><label>Meeting location<input name="location" placeholder="Address or a recognizable landmark" required maxLength="180" /></label><div className="form-grid"><label>Date & time<input name="startsAt" type="datetime-local" required min={minDateTime} /></label><label>Hours<input name="durationHours" type="number" min="1" max="24" defaultValue="2" required /></label></div><label>Volunteer spots<input name="capacity" type="number" min="1" max="10000" defaultValue="12" required /></label>{error && <p className="form-error">{error}</p>}<button className="button button-dark full-button" disabled={busy}>{busy ? 'Posting...' : 'Share with the neighborhood'} <ArrowRight size={16} /></button></form></section></div>
}

function ProfileModal({ profile, onClose, onSave }) {
  async function submit(event) {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget).entries())
    await onSave(data)
  }
  return <div className="modal-backdrop"><section className="dialog form-dialog profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title"><button className="dialog-close" onClick={onClose} aria-label="Close"><X size={19} /></button><div className="eyebrow eyebrow-muted">A LITTLE MORE ABOUT YOU</div><h2 id="profile-title">Your neighbor profile</h2><p className="auth-subtitle">Help us find the good things that feel like you.</p><form className="form-stack" onSubmit={submit}><label>Your name<input name="name" defaultValue={profile?.name || ''} required maxLength="120" /></label><label>Your city<input name="city" defaultValue={profile?.city || ''} placeholder="Portland, OR" maxLength="120" /></label><label>Things you care about<input name="interests" defaultValue={profile?.interests || ''} placeholder="Gardening, animals, helping kids..." maxLength="600" /></label><label>A little about you<textarea name="bio" defaultValue={profile?.bio || ''} rows="3" maxLength="1000" placeholder="Anything you'd like an organization to know?" /></label><button className="button button-dark full-button">Save my profile <Check size={16} /></button></form></section></div>
}

export default App

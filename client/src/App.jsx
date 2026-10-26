import { useState } from 'react';

const ERAS = ['New', 'Classic'];
const MOODS = ['Fun', 'Serious', 'Inspiring', 'Scary'];
const blank = { favorite: '', era: '', mood: '', islandPerson: '' };

function Logo({ small }) {
  return (
    <header className={small ? 'logo small' : 'logo'}>
      <div className="popcorn" aria-hidden="true">🍿</div>
      {!small && <h1>PopChoice</h1>}
    </header>
  );
}

function Chips({ options, value, onChange, label }) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          className={value === o ? 'chip on' : 'chip'}
          onClick={() => onChange(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Setup({ onStart }) {
  const [count, setCount] = useState('');
  const [minutes, setMinutes] = useState('');
  const ok = Number(count) >= 1 && Number(count) <= 10 && Number(minutes) >= 30;
  return (
    <form
      className="stack"
      onSubmit={(e) => { e.preventDefault(); if (ok) onStart(Number(count), Number(minutes)); }}
    >
      <Logo />
      <input className="field center" type="number" min="1" max="10" inputMode="numeric"
        placeholder="How many people?" value={count} onChange={(e) => setCount(e.target.value)} />
      <input className="field center" type="number" min="30" step="5" inputMode="numeric"
        placeholder="How much time do you have? (minutes)" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
      <button className="cta" disabled={!ok}>Start</button>
    </form>
  );
}

function Quiz({ person, total, onNext }) {
  const [a, setA] = useState(blank);
  const set = (k) => (v) => setA((s) => ({ ...s, [k]: v }));
  const ok = a.favorite.trim() && a.era && a.mood && a.islandPerson.trim();
  const last = person === total;
  return (
    <form className="stack quiz" onSubmit={(e) => { e.preventDefault(); if (ok) onNext(a); }}>
      <Logo small />
      <p className="person" aria-label={`Person ${person} of ${total}`}>{person}</p>

      <label className="q" htmlFor="fav">What’s your favorite movie and why?</label>
      <textarea id="fav" className="field" rows="3" value={a.favorite} onChange={(e) => set('favorite')(e.target.value)} />

      <p className="q">Are you in the mood for something new or a classic?</p>
      <Chips label="New or classic" options={ERAS} value={a.era} onChange={set('era')} />

      <p className="q">What are you in the mood for?</p>
      <Chips label="Mood" options={MOODS} value={a.mood} onChange={set('mood')} />

      <label className="q" htmlFor="island">Which famous film person would you love to be stranded on an island with and why?</label>
      <textarea id="island" className="field" rows="2" value={a.islandPerson} onChange={(e) => set('islandPerson')(e.target.value)} />

      <button className="cta" disabled={!ok}>{last ? 'Get Movie' : 'Next Person'}</button>
    </form>
  );
}

function Result({ movies, index, onNext, onReset }) {
  const m = movies[index];
  if (!m) {
    return (
      <div className="stack">
        <Logo small />
        <p className="blurb">{movies.length ? 'That’s all five picks.' : 'Nothing fits that time limit. Try a longer evening.'}</p>
        <button className="cta" onClick={onReset}>Start over</button>
      </div>
    );
  }
  const hasNext = index < movies.length - 1;
  return (
    <div className="stack">
      <h2 className="title">{m.title}{m.year ? ` (${m.year})` : ''}</h2>
      {m.poster ? <img className="poster" src={m.poster} alt={`${m.title} poster`} /> : <div className="poster none" aria-hidden="true">🍿</div>}
      <p className="blurb">{m.reason}</p>
      <button className="cta" onClick={hasNext ? onNext : onReset}>{hasNext ? 'Next Movie' : 'Start over'}</button>
    </div>
  );
}

export default function App() {
  const [step, setStep] = useState('setup');
  const [cfg, setCfg] = useState({ count: 0, minutes: 0 });
  const [person, setPerson] = useState(1);
  const [answers, setAnswers] = useState([]);
  const [movies, setMovies] = useState([]);
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState('');

  const reset = () => { setStep('setup'); setPerson(1); setAnswers([]); setMovies([]); setIdx(0); setError(''); };

  async function submit(all) {
    setStep('loading');
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ people: all, minutes: cfg.minutes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      setMovies(data.movies); setIdx(0); setStep('result');
    } catch (e) {
      setError(e.message); setStep('error');
    }
  }

  function next(a) {
    const all = [...answers, a];
    setAnswers(all);
    if (person < cfg.count) setPerson(person + 1);
    else submit(all);
  }

  return (
    <main className="phone">
      {step === 'setup' && <Setup onStart={(count, minutes) => { setCfg({ count, minutes }); setStep('quiz'); }} />}
      {step === 'quiz' && <Quiz key={person} person={person} total={cfg.count} onNext={next} />}
      {step === 'loading' && <div className="stack"><Logo /><p className="blurb" role="status">Finding a movie everyone can agree on…</p></div>}
      {step === 'result' && <Result movies={movies} index={idx} onNext={() => setIdx(idx + 1)} onReset={reset} />}
      {step === 'error' && (
        <div className="stack"><Logo small /><p className="blurb" role="alert">{error}</p>
          <button className="cta" onClick={() => submit(answers)}>Try again</button></div>
      )}
    </main>
  );
}

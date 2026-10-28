import { useMemo, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Workflow, Task, RequestItem, api, post, dateLabel, ApiError } from './api';
import FormViewer, { FormHandle } from './FormViewer';
import { Workflow as WorkflowIcon, CalendarDays, ClipboardList, History, Search, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, LogOut, ChevronRight, UserRound, RefreshCw, Clock, BriefcaseBusiness, Laptop, FileText, Users, FolderOpen } from 'lucide-react';
const USERS = [{ id: 'E101', name: 'Riya Sen' }, { id: 'M201', name: 'Arun Das' }, { id: 'H001', name: 'HR Head' }, { id: 'E102', name: 'Other Employee' }];
const card = 'bg-white border border-border rounded-card';
const primary = 'inline-flex items-center justify-center gap-2 rounded-ctl bg-accent px-4 py-2.5 text-white font-semibold hover:bg-accentHover disabled:opacity-50';
const secondary = 'inline-flex items-center justify-center gap-2 rounded-ctl border border-border bg-white px-4 py-2.5 font-semibold text-ink2 hover:bg-bg';
const useMe = () => useQuery({
  queryKey: ['me'], queryFn: () => api<{
    user: {
      employee_id: string;
      name: string;
      groups: string[];
    };
    auth_mode: string;
    login_url: string;
  }>('/me'), retry: false
});
const useTasks = (scope = 'all') => useQuery({ queryKey: ['tasks', scope], queryFn: () => api<Task[]>('/tasks?scope=' + scope) });
function Loading() { return <div className="py-16 text-center text-muted">Loading…</div>; }
function ErrorView({ error }: {
  error: unknown;
}) { return <div className="flex items-center gap-2 rounded-ctl border border-red-200 bg-red-50 p-4 text-danger"><AlertCircle size={18} />{error instanceof Error ? error.message : 'Something went wrong.'}</div>; }
function Empty({ title, detail }: {
  title: string;
  detail?: string;
}) { return <div className={`${card} py-16 text-center`}><FolderOpen className="mx-auto mb-3 text-muted" size={30} /><div className="font-semibold text-[17px]">{title}</div>{detail && <div className="mt-1 text-muted">{detail}</div>}</div>; }
function PageTitle({ title, subtitle, back }: {
  title: string;
  subtitle?: string;
  back?: string;
}) { return <div className="mb-7">{back && <Link className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-accent" to={back}><ArrowLeft size={16} /> Back</Link>}<h1 className="text-[29px] font-bold tracking-tight">{title}</h1>{subtitle && <p className="mt-1 text-muted">{subtitle}</p>}</div>; }
function Status({ value }: {
  value: string;
}) { const color = value === 'approved' || value === 'completed' ? 'bg-[#E4F4EA] text-[#17663F]' : value === 'rejected' ? 'bg-[#FBE5E5] text-[#9B1C1C]' : value === 'running' ? 'bg-[#FDF0DA] text-[#7A4204]' : 'bg-[#EEF0F3] text-[#3D4450]'; return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>; }
function Header() { const me = useMe(); const qc = useQueryClient(); const tasks = useTasks(); const [menu, setMenu] = useState(false); const current = me.data?.user; return <header className="sticky top-0 z-40 border-b border-border bg-white"><div className="mx-auto flex h-[64px] max-w-[1160px] items-center gap-6 px-5"><Link to="/start" className="flex shrink-0 items-center gap-2.5 text-[17px] font-bold"><WorkflowIcon className="text-accent" size={24} /> Workflow Portal</Link><nav className="hidden items-center gap-1 md:flex">{[['/start', 'Start a request'], ['/tasks', 'My tasks'], ['/requests', 'My requests']].map(([url, label]) => <NavLink key={url} to={url} className={({ isActive }) => `rounded-ctl px-3.5 py-2 font-medium ${isActive ? 'bg-accentSoft text-accentHover' : 'text-[#525A66] hover:bg-bg'}`}>{label}{url === '/tasks' && !!tasks.data?.length && <span className="ml-2 rounded-full bg-[#EAF0FD] px-2 py-0.5 text-xs">{tasks.data.length}</span>}</NavLink>)}</nav><div className="flex-1" /><div className="relative"><button onClick={() => setMenu(!menu)} className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">{(current?.name || '?').split(' ').map(x => x[0]).slice(0, 2).join('')}</span><span className="hidden text-sm font-semibold sm:inline">{current?.name || 'Account'}</span></button>{menu && <div className="absolute right-0 top-12 w-64 rounded-card border border-border bg-white p-3 shadow-lg"><p className="mb-2 text-xs text-muted">Signed in as {current?.employee_id}</p>{me.data?.auth_mode === 'dev' && <><label className="mb-1 block text-xs font-semibold">Switch test user</label><select className="w-full rounded-ctl border border-inputBorder p-2" value={current?.employee_id || ''} onChange={e => { document.cookie = `portal_dev_user=${e.target.value};path=/;SameSite=Lax`; qc.clear(); location.href = '/start'; }}>{USERS.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></>}{me.data?.auth_mode !== 'dev' && <p className="text-sm text-muted">Authentication managed by your organization</p>}<button className="mt-3 flex items-center gap-2 text-sm text-muted" onClick={() => { document.cookie = 'portal_dev_user=;path=/;max-age=0'; qc.clear(); location.reload(); }}><LogOut size={15} /> Sign out</button></div>}</div></div><nav className="mx-auto flex max-w-[1160px] justify-around border-t border-border px-3 py-1 md:hidden">{[['/start', 'Workflows'], ['/tasks', 'My tasks'], ['/requests', 'My requests']].map(([url, label]) => <NavLink key={url} to={url} className={({ isActive }) => `rounded-ctl px-3 py-2 text-xs font-semibold ${isActive ? 'bg-accentSoft text-accent' : 'text-muted'}`}>{label}</NavLink>)}</nav></header>; }
function SignIn() { const qc = useQueryClient(); return <div className="mx-auto mt-24 max-w-md rounded-card border border-border bg-white p-9 text-center"><WorkflowIcon className="mx-auto mb-3 text-accent" size={38} /><h1 className="text-2xl font-bold">Welcome to Workflow Portal</h1><p className="my-4 text-muted">Choose a development user to continue.</p><div className="space-y-2">{USERS.map(u => <button key={u.id} className={`w-full ${secondary}`} onClick={() => { document.cookie = `portal_dev_user=${u.id};path=/;SameSite=Lax`; qc.clear(); location.reload(); }}>{u.name}<span className="ml-auto text-xs text-muted">{u.id}</span></button>)}</div></div>; }
function StartList() { const { data, isLoading, error } = useQuery({ queryKey: ['workflows'], queryFn: () => api<Workflow[]>('/workflows') }); const [search, setSearch] = useState(''); const [category, setCategory] = useState('All categories'); const cats = useMemo(() => ['All categories', ...new Set((data || []).map(w => w.category))], [data]); const items = (data || []).filter(w => (category === 'All categories' || w.category === category) && `${w.name} ${w.description} ${w.key}`.toLowerCase().includes(search.toLowerCase())); const icons = [CalendarDays, Laptop, Users, BriefcaseBusiness, FileText]; return <><PageTitle title="Start a request" subtitle="Choose a workflow to get started. Your requests are saved and tracked here." /><div className="mb-6 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 text-muted" size={19} /><input aria-label="Search workflows" placeholder="Search workflows…" className="w-full rounded-ctl border border-inputBorder bg-white py-2.5 pl-10 pr-3" value={search} onChange={e => setSearch(e.target.value)} /></div><select aria-label="Category" className="rounded-ctl border border-inputBorder bg-white px-3 py-2.5" value={category} onChange={e => setCategory(e.target.value)}>{cats.map(c => <option key={c}>{c}</option>)}</select></div>{isLoading ? <Loading /> : error ? <ErrorView error={error} /> : items.length === 0 ? <Empty title="No workflows found" detail="Try a different search or category." /> : <div className="grid gap-4 md:grid-cols-2">{items.map((w, i) => { const Icon = icons[i % icons.length]; return <Link key={w.key} to={'/start/' + encodeURIComponent(w.key)} className={`${card} group flex min-h-[164px] flex-col justify-between p-5 hover:border-[#C9D6F5] hover:shadow-sm`}><div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-ctl bg-accentSoft text-accent"><Icon size={23} /></span><div><h2 className="text-lg font-bold">{w.name}</h2><span className="text-xs font-semibold text-muted">{w.category}</span><p className="mt-2 text-sm text-muted">{w.description || 'Start a new ' + w.name.toLowerCase() + ' request.'}</p></div></div><div className="mt-5 flex items-center justify-end gap-1 text-sm font-bold text-accent">Start request <ArrowRight size={16} /></div></Link>; })}</div>}</>; }
function StartRequest() {
  const { key = '' } = useParams(); const navigate = useNavigate(); const qc = useQueryClient(); const ref = useRef<FormHandle>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [result, setResult] = useState(''); const q = useQuery({
    queryKey: ['form', key], queryFn: () => api<{
      workflow: {
        name: string;
        key: string;
      };
      schema: object;
    }>(`/workflows/${encodeURIComponent(key)}/form`)
  }); async function submit() {
    if (!ref.current || busy)
      return; setBusy(true); setError(''); try {
        const r = await ref.current.submit();
        if (r.errors.length) {
          setError('Please correct the highlighted fields.');
          return;
        }
        const created = await post<{
          request_id: string;
        }>(`/workflows/${encodeURIComponent(key)}/start`, { values: r.data });
        setResult(created.request_id);
        qc.invalidateQueries({ queryKey: ['requests'] });
      }
    catch (e) {
      setError((e as Error).message);
    }
    finally {
      setBusy(false);
    }
  } if (result)
    return <div className={`${card} mx-auto max-w-xl p-10 text-center`}><CheckCircle2 className="mx-auto mb-4 text-[#17663F]" size={44} /><h1 className="text-2xl font-bold">Your request was sent</h1><p className="my-3 text-muted">You can follow its progress under My requests.</p><button className={primary} onClick={() => navigate('/requests/' + result)}>View request <ArrowRight size={16} /></button></div>; return <><PageTitle title={q.data?.workflow.name || 'Start request'} subtitle="Complete the form below to submit your request." back="/start" />{q.isLoading ? <Loading /> : q.error ? <ErrorView error={q.error} /> : <div className={`${card} mx-auto max-w-[780px] p-6 sm:p-9`}><FormViewer ref={ref} schema={q.data!.schema} />{error && <div role="alert" className="my-4 text-sm text-danger">{error}</div>}<div className="mt-6 flex justify-end gap-3 border-t border-border pt-6"><Link className={secondary} to="/start">Cancel</Link><button className={primary} disabled={busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit request'} <ArrowRight size={16} /></button></div></div>}</>;
}
function MyTasks() { const [scope, setScope] = useState<'mine' | 'team'>('mine'); const q = useTasks(scope); return <><PageTitle title="My tasks" subtitle="Review and complete the tasks waiting for you." /><div className="mb-5 flex gap-2">{[['mine', 'For me'], ['team', 'For my team']].map(([id, label]) => <button key={id} onClick={() => setScope(id as 'mine' | 'team')} className={`rounded-ctl px-4 py-2 text-sm font-semibold ${scope === id ? 'bg-accentSoft text-accentHover' : 'bg-white text-muted border border-border'}`}>{label}</button>)}</div>{q.isLoading ? <Loading /> : q.error ? <ErrorView error={q.error} /> : !q.data?.length ? <Empty title="Nothing is waiting for you right now." detail="New tasks will appear here when they are assigned." /> : <div className={`${card} overflow-hidden`}>{q.data.map((t, i) => <Link to={'/tasks/' + t.id} key={t.id} className={`flex items-center gap-4 p-5 hover:bg-bg ${i ? 'border-t border-border' : ''}`}><span className="flex h-11 w-11 items-center justify-center rounded-ctl bg-accentSoft text-accent"><ClipboardList size={21} /></span><div className="min-w-0 flex-1"><h2 className="font-bold">{t.name}</h2><p className="truncate text-sm text-muted">{t.workflow_key?.replace(/_/g, ' ')} · Received {dateLabel(t.created)}</p></div>{t.is_team_task && <Status value="Team task" />}{t.due && <span className="hidden text-sm text-muted sm:inline">Due {dateLabel(t.due)}</span>}<ChevronRight size={18} className="text-muted" /></Link>)}</div>}</>; }
function TaskPage() {
  const { id = '' } = useParams(); const qc = useQueryClient(); const navigate = useNavigate(); const ref = useRef<FormHandle>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const q = useQuery({
    queryKey: ['task', id], queryFn: () => api<{
      task: Task;
      schema: object;
      data: Record<string, unknown>;
      needs_claim: boolean;
    }>(`/tasks/${id}`)
  }); async function claim() {
    setBusy(true); setError(''); try {
      await post(`/tasks/${id}/claim`);
      await q.refetch();
      qc.invalidateQueries({ queryKey: ['tasks'] });
    }
      catch (e) {
        setError((e as Error).message);
      }
      finally {
        setBusy(false);
      }
  } async function submit() {
    if (!ref.current)
      return; setBusy(true); setError(''); try {
        const values = await ref.current.submit();
        if (values.errors.length) {
          setError('Please correct the highlighted fields.');
          return;
        }
        await post(`/tasks/${id}/submit`, { values: values.data });
        qc.invalidateQueries({ queryKey: ['tasks'] });
        qc.invalidateQueries({ queryKey: ['requests'] });
        navigate('/tasks');
      }
    catch (e) {
      setError((e as Error).message);
    }
    finally {
      setBusy(false);
    }
  } return <><PageTitle title={q.data?.task.name || 'Task details'} subtitle="Review the details and complete this task." back="/tasks" />{q.isLoading ? <Loading /> : q.error ? <ErrorView error={q.error} /> : <div className={`${card} mx-auto max-w-[780px] p-6 sm:p-9`}><div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-5"><span className="text-sm text-muted">Received {dateLabel(q.data?.task.created)}</span>{q.data?.needs_claim && <Status value="Team task" />}</div><FormViewer ref={ref} schema={q.data!.schema} data={q.data!.data} />{error && <div className="mt-4 text-sm text-danger" role="alert">{error}</div>}<div className="mt-6 flex justify-end gap-3 border-t border-border pt-6"><Link className={secondary} to="/tasks">Back</Link>{q.data?.needs_claim ? <button disabled={busy} className={primary} onClick={claim}>Take this task</button> : <button disabled={busy} className={primary} onClick={submit}>{busy ? 'Submitting…' : 'Submit task'} <CheckCircle2 size={16} /></button>}</div></div>}</>;
}
function MyRequests() {
  const [state, setState] = useState('all'); const [page, setPage] = useState(1); const q = useQuery({
    queryKey: ['requests', state, page], queryFn: () => api<{
      items: RequestItem[];
      total: number;
      page: number;
      page_size: number;
    }>(`/requests?state=${state}&page=${page}`)
  }); return <><PageTitle title="My requests" subtitle="Track the progress of requests you've submitted." /><div className="mb-5 flex gap-2">{[['all', 'All'], ['running', 'In progress'], ['finished', 'Finished']].map(([id, label]) => <button key={id} onClick={() => { setState(id); setPage(1); }} className={`rounded-ctl px-4 py-2 text-sm font-semibold ${state === id ? 'bg-accentSoft text-accentHover' : 'bg-white text-muted border border-border'}`}>{label}</button>)}</div>{q.isLoading ? <Loading /> : q.error ? <ErrorView error={q.error} /> : !q.data?.items.length ? <Empty title="You have not started any requests yet." detail="Choose a workflow to submit your first request." /> : <div className={`${card} overflow-hidden`}>{q.data.items.map((r, i) => <Link key={r.id} to={'/requests/' + r.id} className={`flex items-center gap-4 p-5 hover:bg-bg ${i ? 'border-t border-border' : ''}`}><span className="flex h-11 w-11 items-center justify-center rounded-ctl bg-accentSoft text-accent"><History size={20} /></span><div className="min-w-0 flex-1"><h2 className="truncate font-bold">{r.title}</h2><p className="text-sm text-muted">{r.workflow_name} · {dateLabel(r.started)}</p></div><Status value={r.status} /><ChevronRight className="text-muted" size={18} /></Link>)}</div>}{!!q.data?.items.length && <div className="mt-5 flex justify-end gap-3"><button className={secondary} disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><button className={secondary} disabled={q.data.items.length < 20} onClick={() => setPage(page + 1)}>Next</button></div>}</>;
}
function RequestPage() {
  const { id = '' } = useParams(); const qc = useQueryClient(); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const q = useQuery({
    queryKey: ['request', id], queryFn: () => api<{
      id: string;
      title: string;
      status: string;
      started: string;
      steps: {
        name: string;
        state: string;
        started: string;
      }[];
      waiting_on: {
        task_name: string;
        person_name_or_id: string;
      }[];
      can_withdraw: boolean;
    }>(`/requests/${id}`)
  }); async function withdraw() {
    if (!confirm('Withdraw this request?'))
      return; setBusy(true); try {
        await post(`/requests/${id}/withdraw`);
        await q.refetch();
        qc.invalidateQueries({ queryKey: ['requests'] });
      }
    catch (e) {
      setError((e as Error).message);
    }
    finally {
      setBusy(false);
    }
  } return <><PageTitle title={q.data?.title || 'Request details'} subtitle="View your request's current status and progress." back="/requests" />{q.isLoading ? <Loading /> : q.error ? <ErrorView error={q.error} /> : <div className="grid gap-5 lg:grid-cols-[1fr_310px]"><div className={`${card} p-6`}><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold">Progress</h2><Status value={q.data!.status} /></div>{q.data?.steps.length ? q.data.steps.map((step, i) => <div key={i} className="flex gap-4"><div className="flex flex-col items-center"><span className={`flex h-8 w-8 items-center justify-center rounded-full ${step.state === 'completed' ? 'bg-[#E4F4EA] text-[#17663F]' : 'bg-accentSoft text-accent'}`}>{step.state === 'completed' ? <CheckCircle2 size={17} /> : <Clock size={17} />}</span>{i < q.data!.steps.length - 1 && <div className="my-1 w-px flex-1 bg-border" />}</div><div className="pb-6"><h3 className="font-semibold">{step.name}</h3><p className="mt-1 text-sm text-muted">{dateLabel(step.started)} · {step.state}</p></div></div>) : <p className="text-muted">No progress information is available yet.</p>}</div><div className="space-y-5"><div className={`${card} p-6`}><h2 className="mb-4 font-bold">Request information</h2><p className="text-xs text-muted">Started</p><p className="mb-4 font-medium">{dateLabel(q.data?.started)}</p><p className="text-xs text-muted">Request ID</p><p className="break-all text-sm">{q.data?.id}</p></div><div className={`${card} p-6`}><h2 className="mb-3 font-bold">Waiting on</h2>{q.data?.waiting_on.length ? q.data.waiting_on.map((t, i) => <p className="mb-2 text-sm" key={i}>{t.task_name} <span className="text-muted">· {t.person_name_or_id || 'Unassigned'}</span></p>) : <p className="text-sm text-muted">No outstanding tasks.</p>}</div>{q.data?.can_withdraw && <button disabled={busy} className={`${secondary} w-full text-danger`} onClick={withdraw}>Withdraw request</button>}{error && <p className="text-danger">{error}</p>}</div></div>}</>;
}
export default function App() {
  const me = useMe(); if (me.isLoading)
    return <Loading />; if (me.error) {
      if (me.error instanceof ApiError && me.error.status === 401)
        return <SignIn />;
      return <div className="mx-auto mt-24 max-w-xl"><ErrorView error={me.error} /></div>;
    } return <><Header /><main className="mx-auto max-w-[1060px] px-5 py-9 sm:py-11"><Routes><Route path="/" element={<Navigate to="/start" replace />} /><Route path="/start" element={<StartList />} /><Route path="/start/:key" element={<StartRequest />} /><Route path="/tasks" element={<MyTasks />} /><Route path="/tasks/:id" element={<TaskPage />} /><Route path="/requests" element={<MyRequests />} /><Route path="/requests/:id" element={<RequestPage />} /><Route path="*" element={<Empty title="Page not found" detail="This page may have moved." />} /></Routes></main><footer className="mx-auto max-w-[1060px] px-5 pb-8 text-xs text-muted">Workflow Portal · Powered by your organization's workflow service</footer></>;
}


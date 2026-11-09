import { useEffect, useState } from "react";
import axios from "axios";
import Papa from "papaparse";
import { Mail, Plus, Search, LogOut, Send, CalendarClock } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const http = axios.create({ baseURL: API, withCredentials: true });
type EmailRow = { id:number; recipient:string; subject:string; scheduled_at:string; sent_at?:string; status:string; error_message?:string };
export default function App() {
  const [tab,setTab] = useState<"scheduled"|"sent">("scheduled");
  const [rows,setRows] = useState<EmailRow[]>([]);
  const [user,setUser] = useState<any>(null);
  const [compose,setCompose] = useState(false);
  const [recipients,setRecipients] = useState("");
  const [subject,setSubject] = useState("");
  const [body,setBody] = useState("");
  const [startAt,setStartAt] = useState("");
  const [delay,setDelay] = useState("0");
  const [hourly,setHourly] = useState("100");
  const [count,setCount] = useState(0);
  const [query,setQuery] = useState("");
  const [notice,setNotice] = useState("");
  async function load() {
    try { const [u,r] = await Promise.all([http.get("/auth/me"),http.get("/api/emails",{params:{status:tab}})]); setUser(u.data.user); setRows(r.data); }
    catch { setNotice("Cannot connect to API. Start the backend and infrastructure first."); }
  }
  useEffect(()=>{ load(); },[tab]);
  function parseCsv(file:File) {
    Papa.parse(file,{complete:(result:any)=>{
      const values = result.data.flat().map((x:any)=>String(x||"").trim()).filter((x:string)=>x.includes("@"));
      setRecipients(values.join(", ")); setCount(values.length);
    }});
  }
  async function schedule(e:React.FormEvent) {
    e.preventDefault();
    try {
      const list = recipients.split(/[,\n;]/).map(x=>x.trim()).filter(Boolean);
      const result = await http.post("/api/emails/schedule",{recipients:list,subject,body,startAt:new Date(startAt).toISOString(),delaySeconds:Number(delay),hourlyLimit:Number(hourly)});
      setNotice(`${result.data.count} emails scheduled successfully.`); setCompose(false); setRecipients(""); setSubject(""); setBody(""); setCount(0); load();
    } catch(err:any) { setNotice(err.response?.data?.error || "Scheduling failed."); }
  }
  async function search() {
    try { const r=await http.get("/api/emails/search",{params:{q:query}}); setRows(r.data); }
    catch { setNotice("Search service unavailable."); }
  }
  return <main className="min-h-screen p-5 md:p-10 max-w-7xl mx-auto">
    <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
      <div className="flex items-center gap-3"><div className="p-3 rounded-xl bg-blue-500/20"><Mail className="text-blue-300"/></div><div><h1 className="text-2xl font-bold">ReachInbox</h1><p className="text-slate-400 text-sm">Email scheduling workspace</p></div></div>
      <div className="flex items-center gap-3">{user && <div className="text-right hidden sm:block"><div className="font-semibold">{user.name}</div><div className="text-xs text-slate-400">{user.email}</div></div>}<button className="btn flex gap-2 items-center" onClick={()=>setCompose(true)}><Plus size={18}/> Compose New Email</button><button title="Logout" className="p-2" onClick={async()=>{await http.post("/auth/logout");location.reload();}}><LogOut/></button></div>
    </header>
    {notice && <div className="panel p-3 mb-5 text-sm text-blue-200">{notice}<button className="float-right" onClick={()=>setNotice("")}>×</button></div>}
    <section className="panel p-5 md:p-7">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div><h2 className="text-xl font-semibold">Email activity</h2><p className="text-sm text-slate-400 mt-1">Track your scheduled and delivered messages</p></div>
        <div className="flex gap-2"><input className="field max-w-56" placeholder="Search emails..." value={query} onChange={e=>setQuery(e.target.value)}/><button className="btn" onClick={search}><Search size={18}/></button></div>
      </div>
      <div className="flex gap-2 border-b border-slate-700 mb-4"><button onClick={()=>setTab("scheduled")} className={`px-4 py-3 ${tab==="scheduled"?"border-b-2 border-blue-400 text-blue-300":"text-slate-400"}`}>Scheduled</button><button onClick={()=>setTab("sent")} className={`px-4 py-3 ${tab==="sent"?"border-b-2 border-blue-400 text-blue-300":"text-slate-400"}`}>Sent</button></div>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="text-slate-400"><tr><th className="p-3">Email</th><th className="p-3">Subject</th><th className="p-3">{tab==="sent"?"Sent time":"Scheduled time"}</th><th className="p-3">Status</th></tr></thead><tbody>
      {rows.map(r=><tr key={r.id} className="border-t border-slate-800"><td className="p-3">{r.recipient}</td><td className="p-3">{r.subject}</td><td className="p-3">{new Date(tab==="sent"?(r.sent_at||r.scheduled_at):r.scheduled_at).toLocaleString()}</td><td className="p-3"><span className="rounded-full bg-blue-400/10 text-blue-200 px-3 py-1">{r.status}</span></td></tr>)}
      </tbody></table>{rows.length===0&&<div className="text-center text-slate-400 py-14"><CalendarClock className="mx-auto mb-3"/><p>No {tab} emails yet.</p></div>}</div>
    </section>
    <footer className="text-xs text-slate-500 mt-5 flex items-center gap-2"><Send size={14}/> Test messages are delivered to Ethereal's preview inbox, not real recipients.</footer>
    {compose&&<div className="fixed inset-0 bg-black/70 grid place-items-center p-4 z-10"><form onSubmit={schedule} className="panel w-full max-w-2xl p-6 space-y-4 max-h-[95vh] overflow-y-auto">
      <div className="flex justify-between"><h2 className="text-xl font-bold">Compose email campaign</h2><button type="button" onClick={()=>setCompose(false)}>✕</button></div>
      <label className="block text-sm">Recipients (comma-separated)<textarea className="field mt-2 min-h-24" value={recipients} onChange={e=>setRecipients(e.target.value)} placeholder="alex@example.com, sam@example.com"/></label>
      <label className="block text-sm">Upload CSV<input className="block mt-2 text-sm" type="file" accept=".csv,text/csv" onChange={e=>e.target.files?.[0]&&parseCsv(e.target.files[0])}/><span className="text-slate-400 text-xs">{count} email addresses parsed</span></label>
      <label className="block text-sm">Subject<input required className="field mt-2" value={subject} onChange={e=>setSubject(e.target.value)}/></label>
      <label className="block text-sm">Body<textarea required className="field mt-2 min-h-28" value={body} onChange={e=>setBody(e.target.value)}/></label>
      <div className="grid md:grid-cols-3 gap-3"><label className="text-sm">Start time<input required type="datetime-local" className="field mt-2" value={startAt} onChange={e=>setStartAt(e.target.value)}/></label><label className="text-sm">Delay (seconds)<input type="number" min="0" className="field mt-2" value={delay} onChange={e=>setDelay(e.target.value)}/></label><label className="text-sm">Hourly limit<input type="number" min="1" className="field mt-2" value={hourly} onChange={e=>setHourly(e.target.value)}/></label></div>
      <div className="flex justify-end gap-3"><button type="button" className="px-4 py-2" onClick={()=>setCompose(false)}>Cancel</button><button className="btn">Schedule emails</button></div>
    </form></div>}
  </main>;
}

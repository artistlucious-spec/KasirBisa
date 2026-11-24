const $ = id => document.getElementById(id);
const rp = n => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
let allTransactions = [];
let period = "today";
function dateKey(value){const d=new Date(value);return Number.isNaN(d.getTime())?"":`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function shortId(id){return String(id||"").slice(-6).toUpperCase();}
function getFiltered(){
  const q=$("cari-transaksi").value.trim().toLocaleLowerCase("id-ID"); const from=$("tanggal-dari").value; const to=$("tanggal-sampai").value;
  const now=new Date(); const cutoff=new Date(now); if(period!=="all"&&!from&&!to){cutoff.setHours(0,0,0,0);if(period==="7")cutoff.setDate(cutoff.getDate()-6);if(period==="30")cutoff.setDate(cutoff.getDate()-29);}
  return allTransactions.filter(t=>{
    const key=dateKey(t.waktu); if(from&&key<from)return false;if(to&&key>to)return false;if(!from&&!to&&period!=="all"&&new Date(t.waktu)<cutoff)return false;
    const products=(t.items||[]).map(i=>`${i.nama} ${i.qty}`).join(" "); const payment=t.metodePembayaran==="qris"?(t.labelPembayaran||"QRIS"):"Tunai"; const text=`${t.id} ${new Date(t.waktu).toLocaleString("id-ID")} ${products} ${payment} ${t.total} ${rp(t.total)}`.toLocaleLowerCase("id-ID"); return !q||text.includes(q);
  });
}
function render(){
 const rows=getFiltered(); $("riwayat-jumlah").textContent=rows.length.toLocaleString("id-ID"); $("riwayat-total").textContent=rp(rows.reduce((s,t)=>s+Number(t.total||0),0));
 const target=$("daftar-riwayat");target.replaceChildren();
 if(!rows.length){const p=document.createElement("p");p.className="empty-state";p.textContent=allTransactions.length?"Tidak ada transaksi yang sesuai dengan filter.":"Belum ada transaksi tersimpan.";target.append(p);return;}
 rows.forEach(t=>{const card=document.createElement("button");card.type="button";card.className="transaction-row";const left=document.createElement("span");left.className="transaction-row-main";const id=document.createElement("strong");id.textContent=`Transaksi #${shortId(t.id)}`;const meta=document.createElement("small");const payment=t.metodePembayaran==="qris"?(t.labelPembayaran||"QRIS"):"Tunai";meta.textContent=`${new Date(t.waktu).toLocaleString("id-ID")} · ${(t.items||[]).reduce((s,i)=>s+Number(i.qty||0),0)} barang · ${payment}`;left.append(id,meta);const right=document.createElement("span");right.className="transaction-row-total";const total=document.createElement("strong");total.textContent=rp(t.total);const hint=document.createElement("small");hint.textContent="Lihat detail ›";right.append(total,hint);card.append(left,right);card.addEventListener("click",()=>showDetail(t));target.append(card);});
 $("unduh-csv").disabled=!rows.length;
}
function showDetail(t){
 $("judul-detail-transaksi").textContent=`Transaksi #${shortId(t.id)}`;const target=$("isi-detail-transaksi");target.replaceChildren();
 const date=document.createElement("p");date.className="detail-time";date.textContent=new Date(t.waktu).toLocaleString("id-ID");target.append(date);
 const items=document.createElement("div");items.className="detail-items";(t.items||[]).forEach(i=>{const row=document.createElement("div");row.className="detail-item-row";const name=document.createElement("span");name.textContent=`${i.nama} × ${i.qty}`;const val=document.createElement("strong");val.textContent=rp(Number(i.harga)*Number(i.qty));row.append(name,val);items.append(row);});target.append(items);
 const payment=t.metodePembayaran==="qris"?(t.labelPembayaran||"QRIS"):"Tunai";const summary=document.createElement("div");summary.className="detail-summary";[["Subtotal",rp(t.subtotal)],["Diskon",`−${rp(t.diskon)}`],["PPN",rp(t.ppn)],["Total",rp(t.total)],["Metode pembayaran",payment],["Dibayar",rp(t.dibayar)],...(t.metodePembayaran==="qris"?[]:[["Kembalian",rp(t.kembalian)]])].forEach(([a,b],i)=>{const row=document.createElement("div");row.className=i===3?"detail-grand-total":"";const l=document.createElement("span");l.textContent=a;const v=document.createElement("strong");v.textContent=b;row.append(l,v);summary.append(row);});target.append(summary);$("dialog-detail-transaksi").showModal();
}
function csvCell(v){let s=String(v??"");if(/^[=+\-@\t\r]/.test(s))s="'"+s;return `"${s.replace(/"/g,'""')}"`;}
function downloadCsv(){const rows=getFiltered();const data=[["Nomor transaksi","Waktu","Produk","Subtotal","Diskon","PPN","Total","Metode pembayaran","Dibayar","Kembalian"],...rows.map(t=>[t.id,new Date(t.waktu).toLocaleString("id-ID"),(t.items||[]).map(i=>`${i.nama} x ${i.qty}`).join(", "),t.subtotal,t.diskon,t.ppn,t.total,t.metodePembayaran==="qris"?(t.labelPembayaran||"QRIS"):"Tunai",t.dibayar,t.kembalian])].map(r=>r.map(csvCell).join(",")).join("\r\n");const blob=new Blob(["\uFEFF"+data],{type:"text/csv;charset=utf-8;"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`riwayat-transaksi-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function setPeriod(value){period=value;document.querySelectorAll("[data-period]").forEach(b=>b.classList.toggle("active",b.dataset.period===value));$("tanggal-dari").value="";$("tanggal-sampai").value="";render();}
document.querySelectorAll("[data-period]").forEach(b=>b.addEventListener("click",()=>setPeriod(b.dataset.period)));
["cari-transaksi","tanggal-dari","tanggal-sampai"].forEach(id=>$(id).addEventListener(id==="cari-transaksi"?"input":"change",()=>{period="custom";document.querySelectorAll("[data-period]").forEach(b=>b.classList.remove("active"));render();}));
$("reset-riwayat").addEventListener("click",()=>{$("cari-transaksi").value="";setPeriod("today");});
$("unduh-csv").addEventListener("click",downloadCsv);$("tutup-detail-transaksi").addEventListener("click",()=>$("dialog-detail-transaksi").close());
fetch("/api/transactions",{headers:{Accept:"application/json"}}).then(async r=>{const d=await r.json().catch(()=>({error:"Respons server tidak valid"}));if(r.status===401)location.replace("login.html");if(!r.ok)throw new Error(d.error||"Riwayat tidak dapat dimuat");allTransactions=Array.isArray(d)?d:[];}).catch(e=>{$("pesan-riwayat").textContent=`Riwayat belum dapat dimuat: ${e.message}`;$("pesan-riwayat").className="notice error";}).finally(render);

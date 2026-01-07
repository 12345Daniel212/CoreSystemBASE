document.addEventListener('DOMContentLoaded', () => {
    let db = {
        apps: JSON.parse(localStorage.getItem('NX_DATA')) || [],
        tpl: localStorage.getItem('NX_TPL') || "Hola {cliente}, recordatorio de tu cita: {servicio} el {fecha} a las {hora}."
    };

    const sync = () => {
        localStorage.setItem('NX_DATA', JSON.stringify(db.apps));
        localStorage.setItem('NX_TPL', db.tpl);
        render();
        updateStats();
    };

    // Navegación
    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
            if (btn.dataset.tab === 'tab-timeline') renderTimeline();
        };
    });

    // Renderizado Lista
    function render() {
        const list = document.getElementById('app-list');
        list.innerHTML = '';

        db.apps.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(app => {
            let badge = "bg-slate-500/10 text-slate-500";
            if (app.status === 'Llegó') badge = "bg-emerald-500/10 text-emerald-400";
            if (app.status === 'Canceló') badge = "bg-rose-500/10 text-rose-400";

            list.innerHTML += `
                <tr class="hover:bg-white/[0.01] transition-all group">
                    <td class="px-8 py-6">
                        <div class="font-bold text-white text-sm">${app.client}</div>
                        <div class="text-[10px] text-slate-500">${app.phone}</div>
                    </td>
                    <td class="px-8 py-6">
                        <div class="text-indigo-400 font-bold text-[10px] uppercase">${app.service}</div>
                        <div class="text-white font-black text-sm">$${parseFloat(app.price).toLocaleString()}</div>
                    </td>
                    <td class="px-8 py-6">
                        <div class="text-white text-xs font-bold">${new Date(app.date).toLocaleDateString()}</div>
                        <div class="text-[10px] text-slate-500 font-bold">${new Date(app.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} HRS</div>
                    </td>
                    <td class="px-8 py-6">
                        <span class="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${badge}">${app.status || 'Pendiente'}</span>
                    </td>
                    <td class="px-8 py-6">
                        <div class="flex justify-end gap-2 opacity-30 group-hover:opacity-100 transition-all">
                            <button onclick="sendWA('${app.id}')" class="btn-mando btn-wa text-emerald-500"><i class="fab fa-whatsapp"></i></button>
                            <button onclick="setStatus('${app.id}', 'Llegó')" class="btn-mando btn-check text-indigo-400"><i class="fas fa-check"></i></button>
                            <button onclick="setStatus('${app.id}', 'Canceló')" class="btn-mando btn-cancel text-rose-400"><i class="fas fa-times"></i></button>
                            <button onclick="deleteApp('${app.id}')" class="btn-mando btn-del text-slate-600"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>`;
        });
        document.getElementById('tpl-text').value = db.tpl;
    }

    // Estadísticas
    function updateStats() {
        let rev = 0, count = db.apps.length, llegados = 0, cancelados = 0;
        let services = {};

        db.apps.forEach(a => {
            let p = parseFloat(a.price) || 0;
            if (a.status === 'Llegó') { rev += p; llegados++; }
            if (a.status === 'Canceló') cancelados++;
            services[a.service] = (services[a.service] || 0) + 1;
        });

        // Dashboard
        document.getElementById('dash-rev').innerText = `$${rev.toLocaleString()}`;
        document.getElementById('dash-count').innerText = count;
        document.getElementById('dash-avg').innerText = llegados ? `$${(rev / llegados).toFixed(0)}` : '$0';

        // Pestaña Estadísticas Grid
        const grid = document.getElementById('stats-grid');
        grid.innerHTML = `
            <div class="glass-card p-8">
                <p class="text-[10px] font-black text-slate-500 uppercase mb-2">Ingresos Totales</p>
                <h3 class="text-4xl font-black">$${rev.toLocaleString()}</h3>
            </div>
            <div class="glass-card p-8">
                <p class="text-[10px] font-black text-slate-500 uppercase mb-2">Citas Registradas</p>
                <h3 class="text-4xl font-black text-indigo-500">${count}</h3>
            </div>
            <div class="glass-card p-8">
                <p class="text-[10px] font-black text-slate-500 uppercase mb-2">Ticket Promedio</p>
                <h3 class="text-4xl font-black text-emerald-500">$${llegados ? (rev / llegados).toFixed(0) : 0}</h3>
            </div>
        `;

        // Barras
        const percL = count ? Math.round((llegados / count) * 100) : 0;
        const percC = count ? Math.round((cancelados / count) * 100) : 0;
        document.getElementById('stats-bars').innerHTML = `
            <div>
                <div class="flex justify-between text-[10px] font-black mb-2"><span>COMPLETADOS</span><span>${percL}%</span></div>
                <div class="w-full bg-white/5 h-2 rounded-full overflow-hidden"><div class="bg-emerald-500 h-full" style="width:${percL}%"></div></div>
            </div>
            <div>
                <div class="flex justify-between text-[10px] font-black mb-2"><span>CANCELADOS</span><span>${percC}%</span></div>
                <div class="w-full bg-white/5 h-2 rounded-full overflow-hidden"><div class="bg-rose-500 h-full" style="width:${percC}%"></div></div>
            </div>
        `;

        const best = Object.keys(services).reduce((a, b) => services[a] > services[b] ? a : b, "Ninguno");
        document.getElementById('stat-best-service').innerText = best;
    }

    // AGENDA MAESTRA (Reparada)
    function renderTimeline() {
        const container = document.getElementById('timeline-container');
        const dateInput = document.getElementById('timeline-date').value || new Date().toISOString().split('T')[0];
        if (!container) return;
        container.innerHTML = '';

        for (let h = 8; h <= 20; h++) {
            const slotApps = db.apps.filter(a => a.date.startsWith(dateInput) && new Date(a.date).getHours() === h);
            container.innerHTML += `
                <div class="glass-card p-4 flex items-center gap-6 border-white/5 hover:bg-white/[0.02] transition-all">
                    <div class="w-20 text-right"><span class="text-[10px] font-black text-indigo-500">${h}:00</span></div>
                    <div class="flex-1 flex gap-3 min-h-[40px] items-center border-l border-white/10 pl-6">
                        ${slotApps.length > 0 ? slotApps.map(a => `<div class="bg-indigo-600/20 border border-indigo-500/40 px-4 py-2 rounded-xl text-[10px] font-bold text-white">${a.client} - ${a.service}</div>`).join('') : '<span class="text-slate-800 text-[9px] font-bold uppercase tracking-widest">Disponible</span>'}
                    </div>
                </div>`;
        }
    }

    // Funciones Globales
    window.setStatus = (id, s) => { db.apps.find(a => a.id === id).status = s; sync(); };
    window.deleteApp = (id) => { if (confirm('¿Eliminar permanente?')) { db.apps = db.apps.filter(a => a.id !== id); sync(); } };
    window.saveTpl = () => { db.tpl = document.getElementById('tpl-text').value; sync(); alert('Guardado'); };
    window.clearDB = () => { if (confirm('¿Borrar todo?')) { db.apps = []; sync(); } };

    window.sendWA = (id) => {
        const a = db.apps.find(x => x.id === id);
        const d = new Date(a.date);
        const msg = db.tpl.replace(/{cliente}/g, a.client).replace(/{servicio}/g, a.service).replace(/{fecha}/g, d.toLocaleDateString()).replace(/{hora}/g, d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        window.open(`https://wa.me/${a.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    window.exportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(db.apps);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data");
        XLSX.writeFile(wb, "Zenith_Reporte.xlsx");
    };

    window.exportPDF = () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text("Reporte Zenith Pro", 14, 15);
        const rows = db.apps.map(a => [a.client, a.service, a.price, a.date, a.status]);
        doc.autoTable({ head: [['Cliente', 'Servicio', 'Precio', 'Fecha', 'Estado']], body: rows, startY: 20 });
        doc.save("Reporte.pdf");
    };

    document.getElementById('timeline-date').addEventListener('change', renderTimeline);

    document.getElementById('app-form').onsubmit = (e) => {
        e.preventDefault();
        db.apps.push({
            id: crypto.randomUUID(),
            client: document.getElementById('f-name').value,
            phone: document.getElementById('f-phone').value,
            service: document.getElementById('f-service').value,
            price: document.getElementById('f-price').value,
            date: document.getElementById('f-date').value,
            status: 'Pendiente'
        });
        sync(); closeModal();
    };

    window.closeModal = () => { document.getElementById('modal').classList.add('hidden'); document.getElementById('app-form').reset(); };
    document.getElementById('open-modal').onclick = () => document.getElementById('modal').classList.remove('hidden');

    sync();
});
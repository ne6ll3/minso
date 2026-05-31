
    // ═══════════════════════════════════════════════════════════════════
//  CONFIG — alterar para o URL de produção
// ═══════════════════════════════════════════════════════════════════
const API_BASE = 'https://mineso-backend-mqdo.onrender.com';

// ═══════════════════════════════════════════════════════════════════
//  ESTADO
// ═══════════════════════════════════════════════════════════════════
let _planoSel  = 'trial';
let _metodoSel = 'transferencia';

const PAY_REF = {
  transferencia: 'IBAN: AO06.0040.0000.0000.1234.5678.9 · Mobroh, Lda<br>Referência: use o nome do seu restaurante',
  multicaixa:    'Multicaixa Express: 924 000 000<br>Referência: 123 456 789',
};

        const navbar = document.getElementById('navbar');
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) navbar.classList.add('scrolled');
            else navbar.classList.remove('scrolled');
        });

        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);

document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const t = document.querySelector(a.getAttribute('href'));
    if (t) { e.preventDefault(); t.scrollIntoView({behavior:'smooth'}); }
  });
});

        document.querySelectorAll('.animate-in').forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
            observer.observe(el);
        });

        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) target.scrollIntoView({ behavior: 'smooth' });
            });
        });
        
        // ═══════════════════════════════════════════════════════════════════
//  MODAL
// ═══════════════════════════════════════════════════════════════════
function abrirRegisto(plano) {
  selPlano(plano || 'trial');
  document.getElementById('modalRegisto').classList.add('vis');
  document.getElementById('modalBody').style.display = '';
  document.getElementById('successScreen').style.display = 'none';
  document.getElementById('fStatus').className = 'form-status';
  document.getElementById('fBtnText').textContent = 'Criar conta';
  document.getElementById('fSubmit').disabled = false;
  setTimeout(() => document.getElementById('fNome').focus(), 100);
}

document.getElementById('modalCloseBtn').addEventListener('click', () => {
  document.getElementById('modalRegisto').classList.remove('vis');
});
document.getElementById('modalRegisto').addEventListener('click', e => {
  if (e.target === document.getElementById('modalRegisto'))
    document.getElementById('modalRegisto').classList.remove('vis');
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.getElementById('modalRegisto').classList.remove('vis');
});

// ═══════════════════════════════════════════════════════════════════
//  PLANO / METODO
// ═══════════════════════════════════════════════════════════════════
function selPlano(p) {
  _planoSel = p;
  ['trial','start','pro'].forEach(x => {
    document.getElementById('mp' + x.charAt(0).toUpperCase() + x.slice(1))?.classList.toggle('sel', x === p);
  });
  const isPago = p !== 'trial';
  document.getElementById('payFields').style.display = isPago ? '' : 'none';
  const names = {trial:'Criar conta', start:'Solicitar plano Start', pro:'Solicitar plano Pro'};
  document.getElementById('fBtnText').textContent = names[p] || 'Criar conta';
  const titles = {trial:'Começar grátis — Trial 14 dias', start:'Activar Plano Start', pro:'Activar Plano Pro'};
  document.getElementById('modalTitle').textContent = titles[p] || 'Criar conta MineSO';
}

function selMetodo(m) {
  _metodoSel = m;
  ['transferencia','multicaixa'].forEach(x => {
    const id = 'm' + x.charAt(0).toUpperCase() + x.slice(1);
    document.getElementById(id)?.classList.toggle('sel', x === m);
  });
  document.getElementById('payRef').innerHTML = PAY_REF[m] || '';
}
selMetodo('transferencia'); // inicializar ref display

// ═══════════════════════════════════════════════════════════════════
//  SUBMISSÃO
// ═══════════════════════════════════════════════════════════════════
async function submeterRegisto() {
  const nome       = document.getElementById('fNome').value.trim();
  const email      = document.getElementById('fEmail').value.trim();
  const pass       = document.getElementById('fPass').value;
  const endereco   = document.getElementById('fEndereco').value.trim();
  const contacto   = document.getElementById('fContacto').value.trim();
  const comprovativo = document.getElementById('fComprovativo')?.value.trim() || '';
  const nif        = document.getElementById('fNif')?.value.trim() || '';

  // Validação
  if (!nome)  return mostrarErro('Indique o nome do restaurante.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return mostrarErro('Email inválido.');
  if (!pass || pass.length < 6) return mostrarErro('A password deve ter pelo menos 6 caracteres.');
  if (!contacto) return mostrarErro('Indique um número de contacto.');
  if (_planoSel !== 'trial' && !comprovativo) return mostrarErro('Indique o comprovativo de pagamento para activar o plano.');

  setLoading(true);

  try {
    // 1. Criar conta (sempre com trial inicial)
    const res = await fetch(API_BASE + '/api/tenant/setup', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        tenant_nome:    nome,
        admin_email:    email,
        admin_password: pass,
        endereco:       endereco || 'Luanda, Angola',
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Erro ao criar conta. Tente novamente.');

    // 2. Se plano pago, enviar solicitação de upgrade ao Dev para activação imediata
    if (_planoSel !== 'trial') {
      await fetch(API_BASE + '/api/admin/plano/solicitar', {
        method: 'POST',
        headers: {'Content-Type':'application/json', 'Authorization': 'Bearer ' + data.token},
        body: JSON.stringify({
          plano_desejado:   _planoSel,
          metodo_pagamento: _metodoSel,
          contacto:         contacto + (nif ? ' | NIF:' + nif : ''),
          nif,
          comprovativo,
        }),
      }).catch(() => {}); // best-effort — não bloquear o registo
    }

    // 3. Mostrar sucesso
    mostrarSucesso(data, nome);

  } catch(err) {
    mostrarErro(err.message || 'Erro de ligação. Verifique a sua internet.');
  } finally {
    setLoading(false);
  }
}

function mostrarErro(msg) {
  const el = document.getElementById('fStatus');
  el.className = 'form-status err';
  el.textContent = msg;
  el.scrollIntoView({behavior:'smooth', block:'nearest'});
}

function setLoading(on) {
  const btn  = document.getElementById('fSubmit');
  const text = document.getElementById('fBtnText');
  btn.disabled = on;
  if (on) {
    text.innerHTML = '<span class="spinner" style="border-top-color:var(--black)"></span> A criar conta…';
  } else {
    const names = {trial:'Criar conta', start:'Solicitar plano Start', pro:'Solicitar plano Pro'};
    text.textContent = names[_planoSel] || 'Criar conta';
  }
}

function mostrarSucesso(data, nome) {
  document.getElementById('modalBody').style.display = 'none';
  document.getElementById('successScreen').style.display = '';

  if (_planoSel === 'trial') {
    document.getElementById('successTitle').textContent = 'Conta criada com sucesso!';
    document.getElementById('successText').innerHTML =
      'O <strong>' + esc(nome) + '</strong> está pronto. O trial de 14 dias foi activado.<br>Aceda ao painel para configurar as mesas e o menu.';
  } else {
    const planNome = {start:'Start', pro:'Pro'}[_planoSel];
    document.getElementById('successTitle').textContent = 'Conta criada — plano ' + planNome + ' solicitado!';
    document.getElementById('successText').innerHTML =
      'O registo do <strong>' + esc(nome) + '</strong> foi concluído.<br>' +
      'A equipa Mobroh irá verificar o comprovativo e <strong>activar o plano ' + planNome + ' em até 24h</strong>.<br>' +
      'Enquanto isso pode usar o trial de 14 dias.';
  }

  const kitchenUrl = API_BASE + '/kitchen';
  document.getElementById('successLink').href = kitchenUrl;
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Suporte Enter nos inputs
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('modalRegisto').classList.contains('vis')) {
    const active = document.activeElement;
    if (active && ['INPUT','SELECT'].includes(active.tagName)) submeterRegisto();
  }
});
    
const path=location.pathname;
if(path.endsWith("/login")||path.endsWith("/login.html"))initLogin();
if(path.endsWith("/setup")||path.endsWith("/setup.html"))initSetup();
if(path.endsWith("/dashboard")||path.endsWith("/dashboard.html"))initDashboard();

async function initLogin(){
  const status=await api("/portal/api/setup-status",{method:"GET"},false);
  if(status?.ok&&status.setupRequired){location.replace("/portal/setup.html");return}
  const me=await api("/portal/api/me",{method:"GET"},false);
  if(me?.ok){location.replace("/portal/dashboard.html");return}
  const form=document.getElementById("loginForm"),button=document.getElementById("loginButton"),message=document.getElementById("message");
  form.addEventListener("submit",async e=>{
    e.preventDefault();setMessage(message,"");button.disabled=true;button.textContent="Signing In...";
    const result=await api("/portal/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:form.username.value,password:form.password.value})},false);
    button.disabled=false;button.textContent="Sign In";
    if(!result?.ok){setMessage(message,result?.error||"Unable to sign in.","error");return}
    location.replace("/portal/dashboard.html");
  });
}

async function initSetup(){
  const status=await api("/portal/api/setup-status",{method:"GET"},false);
  if(status?.ok&&!status.setupRequired){location.replace("/portal/login.html");return}
  const form=document.getElementById("setupForm"),button=document.getElementById("setupButton"),message=document.getElementById("message");
  form.addEventListener("submit",async e=>{
    e.preventDefault();setMessage(message,"");button.disabled=true;button.textContent="Creating...";
    const result=await api("/portal/api/setup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({setupKey:form.setupKey.value,fullName:form.fullName.value,username:form.username.value,password:form.password.value})},false);
    button.disabled=false;button.textContent="Create Admin Account";
    if(!result?.ok){setMessage(message,result?.error||"Unable to create admin.","error");return}
    setMessage(message,"Admin account created. Opening login...","success");
    setTimeout(()=>location.replace("/portal/login.html"),900);
  });
}

async function initDashboard(){
  const data=await api("/portal/api/dashboard",{method:"GET"},false);
  if(!data?.ok){location.replace("/portal/login.html");return}
  const user=data.user;
  document.getElementById("userName").textContent=user.fullName;
  document.getElementById("userRole").textContent=roleLabel(user.role);
  document.getElementById("welcomeTitle").textContent=`Welcome, ${firstName(user.fullName)}`;
  document.getElementById("welcomeText").textContent=dashboardMessage(user.role);
  renderStats(data.stats,user.role);renderModules(data.modules);renderSidebar(data.modules);
  document.getElementById("logoutButton").addEventListener("click",async()=>{await api("/portal/api/logout",{method:"POST"},false);location.replace("/portal/login.html")});
}

function renderStats(stats,role){
  const cards=[["Active Employees",stats.employees],["Active Sites",stats.sites],["Present Today",stats.presentToday],["Absent Today",stats.absentToday]];
  if(role!=="supervisor")cards.push(["Salary Pending",stats.salaryPending]);
  document.getElementById("statsGrid").innerHTML=cards.map(([label,value])=>`<article class="stat-card"><span>${escapeHtml(label)}</span><strong>${Number(value||0)}</strong></article>`).join("");
}

function renderModules(modules){
  document.getElementById("moduleGrid").innerHTML=modules.map(m=>`<button class="module-card" type="button" data-module="${escapeHtml(m.key)}"><span class="module-icon">${escapeHtml(m.icon)}</span><strong>${escapeHtml(m.label)}</strong><small>${escapeHtml(moduleDescription(m.key))}</small></button>`).join("");
  document.querySelectorAll(".module-card").forEach(b=>b.addEventListener("click",()=>alert(`${b.dataset.module} module will be connected in the next phase.`)));
}

function renderSidebar(modules){
  const items=[{key:"dashboard",label:"Dashboard",icon:"HOME"},...modules];
  document.getElementById("sideNav").innerHTML=items.map(i=>`<button class="nav-item ${i.key==="dashboard"?"active":""}" type="button"><span class="nav-badge">${escapeHtml(i.icon)}</span><span>${escapeHtml(i.label)}</span></button>`).join("");
}

function moduleDescription(key){
  return {employees:"Employee profiles, codes and company records.",sites:"Project and work-site master records.",attendance:"Daily employee attendance and shift status.",photos:"Date-wise work photos from assigned sites.",salary:"Monthly salary, deductions and payment status.",reports:"Attendance, salary and site-wise reports.",users:"Admin, HR/Office and Supervisor access.",settings:"Portal and company-level settings."}[key]||"Company portal module.";
}
function dashboardMessage(role){if(role==="admin")return"Full company access is enabled for your Admin account.";if(role==="hr")return"Employee, salary and reporting access is enabled for HR/Office.";return"Attendance and daily photo access is enabled for your assigned site."}
function roleLabel(role){if(role==="hr")return"HR / Office";if(role==="supervisor")return"Supervisor";return"Admin"}
function firstName(value){return String(value||"").trim().split(/\s+/)[0]||"User"}
async function api(url,options,throwOnNetwork=true){try{const r=await fetch(url,{credentials:"same-origin",cache:"no-store",...options});return await r.json()}catch(e){if(throwOnNetwork)throw e;return null}}
function setMessage(el,text,type=""){el.textContent=text;el.className=`form-message ${type}`.trim()}
function escapeHtml(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}

(function () {
    const API_BASE = window.location.origin + "/api";

    let session = {
        loggedIn: false,
        role: null,
        email: null,
        nom: "",
        prenom: "",
    };

    function getToken() {
        return localStorage.getItem("se_token");
    }

    function clearAuth() {
        localStorage.removeItem("se_token");
        localStorage.removeItem("se_role");
        localStorage.removeItem("se_email");
    }

    function saveAuth(token, role, email) {
        localStorage.setItem("se_token", token);
        localStorage.setItem("se_role", role);
        localStorage.setItem("se_email", email || "");
    }

    async function parseError(res) {
        const t = await res.text();
        try {
            const j = JSON.parse(t);
            if (typeof j.detail === "string") return j.detail;
            if (Array.isArray(j.detail)) {
                return j.detail.map((e) => e.msg || JSON.stringify(e)).join("; ");
            }
            if (j.detail) return JSON.stringify(j.detail);
        } catch (_) {
            if (t) return t;
        }
        return "Erreur " + res.status;
    }

    async function apiFetch(path, options) {
        const token = getToken();
        const headers = Object.assign({}, options && options.headers);
        if (token && !(options.body instanceof FormData)) {
            headers["Authorization"] = "Bearer " + token;
        }
        if (
            options.body &&
            typeof options.body === "string" &&
            !headers["Content-Type"]
        ) {
            headers["Content-Type"] = "application/json";
        }
        const res = await fetch(API_BASE + path, Object.assign({}, options, { headers }));
        return res;
    }

    function navigate(page) {
        document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
        document.querySelectorAll("nav a").forEach((a) => a.classList.remove("active"));
        document.getElementById("page-" + page).classList.add("active");
        const navEl = document.getElementById("nav-" + page);
        if (navEl) navEl.classList.add("active");
        if (window.innerWidth <= 768)
            document.getElementById("sidebar").classList.remove("open");

        if (page === "sujets") void renderSujetsPage();
        if (page === "cours") void renderCoursPage();
        if (page === "qcm") void renderQcmPage();
        if (page === "admin") void renderAdmin();
    }

    window.toggleSidebar = function () {
        document.getElementById("sidebar").classList.toggle("open");
    };

    window.switchAuthTab = function (tab) {
        document.querySelectorAll("#page-auth .tab-btn").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll("#page-auth .tab-content").forEach((c) => c.classList.remove("active"));
        document.getElementById("auth-tab-" + tab).classList.add("active");
        const tabs = document.querySelectorAll("#page-auth .tab-btn");
        if (tab === "login") tabs[0].classList.add("active");
        else tabs[1].classList.add("active");
        const bottom = document.getElementById("register-bottom-notice");
        if (bottom) bottom.style.display = "none";
    };

    window.switchAdminTab = function (tab, btn) {
        document.querySelectorAll("#page-admin .tabs-bar .tab-btn").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll("#page-admin .tab-content").forEach((c) => c.classList.remove("active"));
        document.getElementById("admin-tab-" + tab).classList.add("active");
        if (btn) btn.classList.add("active");
        void renderAdmin();
    };

    function showAlert(id, type, msg) {
        document.getElementById(id).innerHTML =
            '<div class="alert alert-' + type + '">' + esc(msg) + "</div>";
    }

    function clearAlert(id) {
        document.getElementById(id).innerHTML = "";
    }

    window.doLogin = async function () {
        const email = document.getElementById("login-email").value.trim().toLowerCase();
        const pass = document.getElementById("login-password").value;
        clearAlert("login-alert");

        if (!email || !pass) {
            showAlert("login-alert", "error", "Tous les champs sont obligatoires.");
            return;
        }

        try {
            const res = await apiFetch("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email: email, password: pass }),
            });
            if (!res.ok) {
                showAlert("login-alert", "error", await parseError(res));
                return;
            }
            const data = await res.json();
            saveAuth(data.token, data.role, email);
            const display = email.includes("@") ? email.split("@")[0] : email;
            session = {
                loggedIn: true,
                role: data.role,
                email: email,
                nom: data.role === "admin" ? "Admin" : display,
                prenom: "",
            };
            afterLogin();
            if (data.role === "admin") navigate("admin");
            else if (data.role === "user") navigate("sujets");
            else {
                showAlert(
                    "login-alert",
                    "warning",
                    "Votre compte est en attente de validation par l'administrateur."
                );
                navigate("accueil");
            }
        } catch (e) {
            showAlert("login-alert", "error", "Impossible de contacter le serveur.");
            console.error(e);
        }
    };

    window.doRegister = async function () {
        const nom = document.getElementById("reg-nom").value.trim();
        const prenom = document.getElementById("reg-prenom").value.trim();
        const email = document.getElementById("reg-email").value.trim().toLowerCase();
        const pass = document.getElementById("reg-password").value;
        const etab = document.getElementById("reg-etablissement").value.trim();
        const exam = document.getElementById("reg-examen").value.trim();
        const num = document.getElementById("reg-numero").value.trim();
        clearAlert("register-alert");
        const regBottom = document.getElementById("register-bottom-notice");
        if (regBottom) regBottom.style.display = "none";

        if (!nom || !prenom || !email || !pass || !etab || !exam || !num) {
            showAlert("register-alert", "error", "Tous les champs sont obligatoires.");
            return;
        }

        try {
            const res = await apiFetch("/auth/register", {
                method: "POST",
                body: JSON.stringify({
                    nom: nom,
                    prenom: prenom,
                    email: email,
                    password: pass,
                    etablissement: etab,
                    examen: exam,
                    paye_numero: num,
                }),
            });
            if (!res.ok) {
                showAlert("register-alert", "error", await parseError(res));
                return;
            }
            showAlert("register-alert", "success", "Inscription reussie !");
            [
                "reg-nom",
                "reg-prenom",
                "reg-email",
                "reg-password",
                "reg-etablissement",
                "reg-examen",
                "reg-numero",
            ].forEach((id) => (document.getElementById(id).value = ""));
            if (regBottom) regBottom.style.display = "block";
        } catch (e) {
            showAlert("register-alert", "error", "Impossible de contacter le serveur.");
            console.error(e);
        }
    };

    function afterLogin() {
        updateNavMenu();
        document.getElementById("btn-logout").style.display = "block";
        const box = document.getElementById("sidebar-user-box");
        box.style.display = "block";
        document.getElementById("sidebar-user-name").textContent =
            (session.nom + " " + session.prenom).trim() || session.email || "";
        document.getElementById("sidebar-user-role").textContent =
            session.role === "admin"
                ? "Administrateur"
                : session.role === "user"
                  ? "Utilisateur valide"
                  : "Visiteur";
    }

    window.logout = function () {
        clearAuth();
        session = {
            loggedIn: false,
            role: null,
            email: null,
            nom: "",
            prenom: "",
        };
        document.getElementById("btn-logout").style.display = "none";
        document.getElementById("sidebar-user-box").style.display = "none";
        ["nav-li-sujets", "nav-li-cours", "nav-li-qcm", "nav-li-admin"].forEach((id) => {
            document.getElementById(id).style.display = "none";
        });
        navigate("accueil");
    };

    function updateNavMenu() {
        document.getElementById("nav-li-sujets").style.display =
            session.role === "user" ? "" : "none";
        document.getElementById("nav-li-cours").style.display =
            session.role === "user" ? "" : "none";
        document.getElementById("nav-li-qcm").style.display =
            session.role === "user" ? "" : "none";
        document.getElementById("nav-li-admin").style.display =
            session.role === "admin" ? "" : "none";
    }

    function mediaUrl(path) {
        if (!path) return "";
        if (path.startsWith("http://") || path.startsWith("https://")) return path;
        return window.location.origin + path;
    }

    window.renderSujetsPage = async function () {
        const restricted = session.role !== "user";
        document.getElementById("sujets-restricted").style.display = restricted ? "" : "none";
        document.getElementById("sujets-content").style.display = restricted ? "none" : "";
        if (!restricted) await filterSujets();
    };

    window.filterSujets = async function () {
        const niveau = document.getElementById("sujets-niveau").value;
        const sel = document.getElementById("sujets-filiere");
        try {
            const res = await apiFetch(
                "/content/sujets?niveau=" + encodeURIComponent(niveau)
            );
            if (!res.ok) {
                sel.innerHTML = '<option value="">-- Erreur --</option>';
                return;
            }
            const data = await res.json();
            const filieres = [
                ...new Set(data.map((s) => s.filiere).filter(Boolean)),
            ].sort();
            sel.innerHTML =
                '<option value="">-- Toutes --</option>' +
                (filieres.length
                    ? filieres.map((f) => '<option value="' + escAttr(f) + '">' + esc(f) + "</option>").join("")
                    : '<option value="">Aucune filiere</option>');
            await renderSujets();
        } catch (e) {
            console.error(e);
        }
    };

    window.renderSujets = async function () {
        const niveau = document.getElementById("sujets-niveau").value;
        const filiere = document.getElementById("sujets-filiere").value;
        let path = "/content/sujets?niveau=" + encodeURIComponent(niveau);
        if (filiere) path += "&filiere=" + encodeURIComponent(filiere);
        const el = document.getElementById("sujets-list");
        try {
            const res = await apiFetch(path);
            if (!res.ok) {
                el.innerHTML = emptyState("Acces refuse ou erreur serveur.");
                return;
            }
            const sujets = await res.json();
            if (!sujets.length) {
                el.innerHTML = emptyState("Aucun sujet disponible pour ce niveau et cette filiere.");
                return;
            }
            el.innerHTML = sujets
                .map(
                    (s) =>
                        `<div class="item-row fade-up">
      <div class="item-row-info">
        <strong>${esc(s.titre)}</strong>
        <span>${esc(s.niveau)} &bull; ${esc(s.filiere)}</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <span class="badge badge-gold">${esc(s.niveau)}</span>
        <a href="${esc(mediaUrl(s.fichier))}" target="_blank" rel="noopener" class="btn btn-success" style="text-decoration:none;">Telecharger</a>
      </div>
    </div>`
                )
                .join("");
        } catch (e) {
            el.innerHTML = emptyState("Erreur reseau.");
            console.error(e);
        }
    };

    window.renderCoursPage = async function () {
        const restricted = session.role !== "user";
        document.getElementById("cours-restricted").style.display = restricted ? "" : "none";
        document.getElementById("cours-content").style.display = restricted ? "none" : "";
        if (!restricted) await filterCours();
    };

    window.filterCours = async function () {
        const niveau = document.getElementById("cours-niveau").value;
        const sel = document.getElementById("cours-filiere");
        try {
            const res = await apiFetch(
                "/content/cours?niveau=" + encodeURIComponent(niveau)
            );
            if (!res.ok) {
                sel.innerHTML = '<option value="">-- Erreur --</option>';
                return;
            }
            const data = await res.json();
            const filieres = [
                ...new Set(data.map((c) => c.filiere).filter(Boolean)),
            ].sort();
            sel.innerHTML =
                '<option value="">-- Toutes --</option>' +
                (filieres.length
                    ? filieres.map((f) => '<option value="' + escAttr(f) + '">' + esc(f) + "</option>").join("")
                    : '<option value="">Aucune filiere</option>');
            await renderCours();
        } catch (e) {
            console.error(e);
        }
    };

    function getYoutubeId(url) {
        if (!url) return null;
        const m = url.match(
            /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/
        );
        return m ? m[1] : null;
    }

    function coursEmbed(video) {
        const yid = getYoutubeId(video);
        if (yid) {
            return (
                '<iframe width="100%" height="240" src="https://www.youtube.com/embed/' +
                escAttr(yid) +
                '" frameborder="0" allowfullscreen style="border-radius:8px;margin-top:12px;"></iframe>'
            );
        }
        const u = mediaUrl(video);
        if (/\.(mp4|webm|ogg)(\?|$)/i.test(video || "") || (video && video.indexOf("/uploads/") === 0)) {
            return (
                '<video controls width="100%" style="border-radius:8px;margin-top:12px;" src="' +
                escAttr(u) +
                '"></video>'
            );
        }
        return (
            '<a href="' +
            escAttr(u) +
            '" target="_blank" rel="noopener" class="btn btn-success" style="text-decoration:none;margin-top:12px;display:inline-flex;">Voir le cours</a>'
        );
    }

    window.renderCours = async function () {
        const niveau = document.getElementById("cours-niveau").value;
        const filiere = document.getElementById("cours-filiere").value;
        let path = "/content/cours?niveau=" + encodeURIComponent(niveau);
        if (filiere) path += "&filiere=" + encodeURIComponent(filiere);
        const el = document.getElementById("cours-list");
        try {
            const res = await apiFetch(path);
            if (!res.ok) {
                el.innerHTML = emptyState("Acces refuse ou erreur serveur.");
                return;
            }
            const cours = await res.json();
            if (!cours.length) {
                el.innerHTML = emptyState("Aucun cours disponible pour ce niveau et cette filiere.");
                return;
            }
            el.innerHTML = cours
                .map(
                    (c) =>
                        `<div class="card fade-up" style="margin-bottom:16px;">
      <strong style="font-size:1rem;color:var(--gold-light);">${esc(c.titre)}</strong>
      <span style="font-size:0.78rem;color:var(--text-muted);display:block;margin:4px 0 0;">${esc(c.niveau)} &bull; ${esc(c.filiere)}</span>
      ${coursEmbed(c.video)}
    </div>`
                )
                .join("");
        } catch (e) {
            el.innerHTML = emptyState("Erreur reseau.");
            console.error(e);
        }
    };

    window.renderQcmPage = async function () {
        const restricted = session.role !== "user";
        document.getElementById("qcm-restricted").style.display = restricted ? "" : "none";
        document.getElementById("qcm-content").style.display = restricted ? "none" : "";
        if (!restricted) await filterQcm();
    };

    let qcmCache = [];

    window.filterQcm = async function () {
        const niveau = document.getElementById("qcm-niveau").value;
        const sel = document.getElementById("qcm-filiere");
        try {
            const res = await apiFetch("/content/qcm?niveau=" + encodeURIComponent(niveau));
            if (!res.ok) {
                sel.innerHTML = '<option value="">-- Erreur --</option>';
                return;
            }
            const data = await res.json();
            const filieres = [
                ...new Set(data.map((q) => q.filiere).filter(Boolean)),
            ].sort();
            sel.innerHTML =
                '<option value="">-- Toutes --</option>' +
                (filieres.length
                    ? filieres.map((f) => '<option value="' + escAttr(f) + '">' + esc(f) + "</option>").join("")
                    : '<option value="">Aucune filiere</option>');
            await renderQcm();
        } catch (e) {
            console.error(e);
        }
    };

    window.renderQcm = async function () {
        const niveau = document.getElementById("qcm-niveau").value;
        const filiere = document.getElementById("qcm-filiere").value;
        let path = "/content/qcm?niveau=" + encodeURIComponent(niveau);
        if (filiere) path += "&filiere=" + encodeURIComponent(filiere);
        document.getElementById("qcm-score").style.display = "none";
        const submitWrap = document.getElementById("qcm-submit-wrap");
        const el = document.getElementById("qcm-questions");
        try {
            const res = await apiFetch(path);
            if (!res.ok) {
                el.innerHTML = emptyState("Acces refuse ou erreur serveur.");
                submitWrap.style.display = "none";
                qcmCache = [];
                return;
            }
            qcmCache = await res.json();
            if (!qcmCache.length) {
                el.innerHTML = emptyState("Aucun QCM disponible pour ce niveau et cette filiere.");
                submitWrap.style.display = "none";
                return;
            }
            el.innerHTML = qcmCache
                .map(
                    (q, i) =>
                        `<div class="qcm-question fade-up">
      <p>${i + 1}. ${esc(q.question)}</p>
      ${(q.options || [])
          .map(
              (opt) =>
                  `<label class="qcm-option">
          <input type="radio" name="qcm_${i}" value="${escAttr(opt)}"/> ${esc(opt)}
        </label>`
          )
          .join("")}
    </div>`
                )
                .join("");
            submitWrap.style.display = "block";
        } catch (e) {
            el.innerHTML = emptyState("Erreur reseau.");
            submitWrap.style.display = "none";
            qcmCache = [];
            console.error(e);
        }
    };

    window.validerQcm = function () {
        let score = 0;
        qcmCache.forEach((q, i) => {
            const inp = document.querySelector('input[name="qcm_' + i + '"]:checked');
            if (inp && inp.value === q.answer) score++;
        });
        const scoreDiv = document.getElementById("qcm-score");
        document.getElementById("qcm-score-num").textContent =
            score + " / " + (qcmCache.length || 0);
        scoreDiv.style.display = "block";
        scoreDiv.scrollIntoView({ behavior: "smooth" });
    };

    window.renderAdmin = async function () {
        await renderPending();
        await renderAdminAccounts();
        await renderAdminSujets();
        await renderAdminCours();
        await renderAdminQcm();
        await renderAdminVisitors();
    };

    async function renderPending() {
        const el = document.getElementById("pending-list");
        try {
            const res = await apiFetch("/admin/pending");
            if (!res.ok) {
                el.innerHTML = '<div class="alert alert-error">Acces refuse.</div>';
                return;
            }
            const users = await res.json();
            document.getElementById("pending-count").textContent = users.length;
            if (!users.length) {
                el.innerHTML =
                    '<div class="alert alert-info">Aucun utilisateur en attente de validation.</div>';
                return;
            }
            el.innerHTML = users
                .map(
                    (u) =>
                        `<div class="user-row fade-up">
      <div class="user-row-info">
        <strong>${esc(u.nom)} ${esc(u.prenom)}</strong>
        <span>${esc(u.email)} &bull; Paiement: ${esc(u.paye_numero)}</span>
      </div>
      <button type="button" class="btn btn-success" data-email="${escAttr(u.email)}">Valider</button>
    </div>`
                )
                .join("");
            el.querySelectorAll("button[data-email]").forEach((btn) => {
                btn.onclick = function () {
                    validateUser(btn.getAttribute("data-email"));
                };
            });
        } catch (e) {
            el.innerHTML = '<div class="alert alert-error">Erreur reseau.</div>';
            console.error(e);
        }
    }

    async function validateUser(email) {
        try {
            const res = await apiFetch(
                "/admin/validate/" + encodeURIComponent(email),
                { method: "POST" }
            );
            if (!res.ok) {
                alert(await parseError(res));
                return;
            }
            await renderPending();
            await renderAdminAccounts();
            await renderAdminVisitors();
        } catch (e) {
            console.error(e);
        }
    }

    async function renderAdminAccounts() {
        const el = document.getElementById("accounts-list");
        if (!el) return;
        try {
            const res = await apiFetch("/admin/accounts");
            if (!res.ok) {
                el.innerHTML = '<div class="alert alert-error">Acces refuse.</div>';
                return;
            }
            const users = await res.json();
            const countEl = document.getElementById("accounts-count");
            if (countEl) countEl.textContent = users.length;
            if (!users.length) {
                el.innerHTML =
                    '<div class="alert alert-info">Aucun compte enregistre.</div>';
                return;
            }
            el.innerHTML = users
                .map((u) => {
                    const statut = u.inscrit
                        ? '<span style="color:var(--success)">Valide</span>'
                        : '<span style="color:var(--warning)">En attente de validation</span>';
                    return `<div class="user-row fade-up">
      <div class="user-row-info">
        <strong>${esc(u.nom)} ${esc(u.prenom)}</strong>
        <span>${esc(u.email)} &bull; ${esc(u.etablissement || "")} &bull; Examen: ${esc(
                        u.examen || ""
                    )}</span>
        <span style="display:block;margin-top:6px;font-size:0.85rem;color:var(--text-muted);">Paiement: ${esc(
                        u.paye_numero || ""
                    )} &bull; ${statut} &bull; Role: ${esc(u.role || "visitor")}</span>
      </div>
    </div>`;
                })
                .join("");
        } catch (e) {
            el.innerHTML = '<div class="alert alert-error">Erreur reseau.</div>';
            console.error(e);
        }
    }

    window.adminAddSujet = async function () {
        const titre = document.getElementById("a-sujet-titre").value.trim();
        const niveau = document.getElementById("a-sujet-niveau").value;
        const filiere = document.getElementById("a-sujet-filiere").value.trim();
        const fileInput = document.getElementById("a-sujet-fichier");
        clearAlert("admin-sujet-alert");
        if (!titre || !filiere || !fileInput.files || !fileInput.files[0]) {
            showAlert("admin-sujet-alert", "error", "Tous les champs sont obligatoires (fichier inclus).");
            return;
        }
        const fd = new FormData();
        fd.append("titre", titre);
        fd.append("niveau", niveau);
        fd.append("filiere", filiere);
        fd.append("fichier", fileInput.files[0]);
        try {
            const res = await apiFetch("/content/sujets", { method: "POST", body: fd });
            if (!res.ok) {
                showAlert("admin-sujet-alert", "error", await parseError(res));
                return;
            }
            showAlert("admin-sujet-alert", "success", "Sujet ajoute avec succes !");
            ["a-sujet-titre", "a-sujet-filiere"].forEach((id) => (document.getElementById(id).value = ""));
            fileInput.value = "";
            await renderAdminSujets();
        } catch (e) {
            showAlert("admin-sujet-alert", "error", "Erreur reseau.");
            console.error(e);
        }
    };

    async function renderAdminSujets() {
        const el = document.getElementById("admin-sujets-list");
        try {
            const res = await apiFetch("/content/sujets");
            if (!res.ok) {
                el.innerHTML = emptyState("Acces refuse.");
                return;
            }
            const sujets = await res.json();
            document.getElementById("sujets-count").textContent = sujets.length;
            if (!sujets.length) {
                el.innerHTML = emptyState("Aucun sujet enregistre.");
                return;
            }
            el.innerHTML = sujets
                .map(
                    (_, i) =>
                        `<div class="item-row">
      <div class="item-row-info">
        <strong>${esc(sujets[i].titre)}</strong>
        <span>${esc(sujets[i].niveau)} &bull; ${esc(sujets[i].filiere)}</span>
      </div>
      <button type="button" class="btn btn-danger" data-idx="${i}">Supprimer</button>
    </div>`
                )
                .join("");
            el.querySelectorAll("button[data-idx]").forEach((btn) => {
                btn.onclick = function () {
                    deleteSujet(parseInt(btn.getAttribute("data-idx"), 10));
                };
            });
        } catch (e) {
            el.innerHTML = emptyState("Erreur.");
            console.error(e);
        }
    }

    async function deleteSujet(i) {
        if (!confirm("Supprimer ce sujet ?")) return;
        try {
            const res = await apiFetch("/content/sujets/" + i, { method: "DELETE" });
            if (!res.ok) {
                alert(await parseError(res));
                return;
            }
            await renderAdminSujets();
        } catch (e) {
            console.error(e);
        }
    }

    window.adminAddCours = async function () {
        const titre = document.getElementById("a-cours-titre").value.trim();
        const niveau = document.getElementById("a-cours-niveau").value;
        const filiere = document.getElementById("a-cours-filiere").value.trim();
        const fileInput = document.getElementById("a-cours-video");
        clearAlert("admin-cours-alert");
        if (!titre || !filiere || !fileInput.files || !fileInput.files[0]) {
            showAlert("admin-cours-alert", "error", "Tous les champs sont obligatoires (video incluse).");
            return;
        }
        const fd = new FormData();
        fd.append("titre", titre);
        fd.append("niveau", niveau);
        fd.append("filiere", filiere);
        fd.append("video", fileInput.files[0]);
        try {
            const res = await apiFetch("/content/cours", { method: "POST", body: fd });
            if (!res.ok) {
                showAlert("admin-cours-alert", "error", await parseError(res));
                return;
            }
            showAlert("admin-cours-alert", "success", "Cours ajoute avec succes !");
            ["a-cours-titre", "a-cours-filiere"].forEach((id) => (document.getElementById(id).value = ""));
            fileInput.value = "";
            await renderAdminCours();
        } catch (e) {
            showAlert("admin-cours-alert", "error", "Erreur reseau.");
            console.error(e);
        }
    };

    async function renderAdminCours() {
        const el = document.getElementById("admin-cours-list");
        try {
            const res = await apiFetch("/content/cours");
            if (!res.ok) {
                el.innerHTML = emptyState("Acces refuse.");
                return;
            }
            const cours = await res.json();
            document.getElementById("cours-count").textContent = cours.length;
            if (!cours.length) {
                el.innerHTML = emptyState("Aucun cours enregistre.");
                return;
            }
            el.innerHTML = cours
                .map(
                    (_, i) =>
                        `<div class="item-row">
      <div class="item-row-info">
        <strong>${esc(cours[i].titre)}</strong>
        <span>${esc(cours[i].niveau)} &bull; ${esc(cours[i].filiere)}</span>
      </div>
      <button type="button" class="btn btn-danger" data-idx="${i}">Supprimer</button>
    </div>`
                )
                .join("");
            el.querySelectorAll("button[data-idx]").forEach((btn) => {
                btn.onclick = function () {
                    deleteCours(parseInt(btn.getAttribute("data-idx"), 10));
                };
            });
        } catch (e) {
            el.innerHTML = emptyState("Erreur.");
            console.error(e);
        }
    }

    async function deleteCours(i) {
        if (!confirm("Supprimer ce cours ?")) return;
        try {
            const res = await apiFetch("/content/cours/" + i, { method: "DELETE" });
            if (!res.ok) {
                alert(await parseError(res));
                return;
            }
            await renderAdminCours();
        } catch (e) {
            console.error(e);
        }
    }

    window.adminAddQcm = async function () {
        const question = document.getElementById("a-qcm-question").value.trim();
        const optStr = document.getElementById("a-qcm-options").value.trim();
        const answer = document.getElementById("a-qcm-answer").value.trim();
        const niveau = document.getElementById("a-qcm-niveau").value;
        const filiere = document.getElementById("a-qcm-filiere").value.trim();
        clearAlert("admin-qcm-alert");
        if (!question || !optStr || !answer || !filiere) {
            showAlert("admin-qcm-alert", "error", "Tous les champs sont obligatoires.");
            return;
        }
        const fd = new FormData();
        fd.append("question", question);
        fd.append("options", optStr);
        fd.append("answer", answer);
        fd.append("niveau", niveau);
        fd.append("filiere", filiere);
        try {
            const res = await apiFetch("/content/qcm", { method: "POST", body: fd });
            if (!res.ok) {
                showAlert("admin-qcm-alert", "error", await parseError(res));
                return;
            }
            showAlert("admin-qcm-alert", "success", "QCM ajoute avec succes !");
            ["a-qcm-question", "a-qcm-options", "a-qcm-answer", "a-qcm-filiere"].forEach(
                (id) => (document.getElementById(id).value = "")
            );
            await renderAdminQcm();
        } catch (e) {
            showAlert("admin-qcm-alert", "error", "Erreur reseau.");
            console.error(e);
        }
    };

    async function renderAdminQcm() {
        const el = document.getElementById("admin-qcm-list");
        try {
            const res = await apiFetch("/content/qcm");
            if (!res.ok) {
                el.innerHTML = emptyState("Acces refuse.");
                return;
            }
            const qcms = await res.json();
            document.getElementById("qcms-count").textContent = qcms.length;
            if (!qcms.length) {
                el.innerHTML = emptyState("Aucun QCM enregistre.");
                return;
            }
            el.innerHTML = qcms
                .map(
                    (_, i) =>
                        `<div class="item-row">
      <div class="item-row-info">
        <strong>${esc(qcms[i].question)}</strong>
        <span>${esc(qcms[i].niveau)} &bull; ${esc(qcms[i].filiere)} &bull; ${(qcms[i].options || []).length} options</span>
      </div>
      <button type="button" class="btn btn-danger" data-idx="${i}">Supprimer</button>
    </div>`
                )
                .join("");
            el.querySelectorAll("button[data-idx]").forEach((btn) => {
                btn.onclick = function () {
                    deleteQcm(parseInt(btn.getAttribute("data-idx"), 10));
                };
            });
        } catch (e) {
            el.innerHTML = emptyState("Erreur.");
            console.error(e);
        }
    }

    async function deleteQcm(i) {
        if (!confirm("Supprimer ce QCM ?")) return;
        try {
            const res = await apiFetch("/content/qcm/" + i, { method: "DELETE" });
            if (!res.ok) {
                alert(await parseError(res));
                return;
            }
            await renderAdminQcm();
        } catch (e) {
            console.error(e);
        }
    }

    async function renderAdminVisitors() {
        const el = document.getElementById("visitors-list");
        try {
            const res = await apiFetch("/admin/visitors");
            if (!res.ok) {
                el.innerHTML = '<div class="alert alert-error">Acces refuse.</div>';
                return;
            }
            const visitors = await res.json();
            document.getElementById("visitors-count").textContent = visitors.length;
            if (!visitors.length) {
                el.innerHTML =
                    '<div class="alert alert-info">Aucun visiteur avec le role visiteur.</div>';
                return;
            }
            el.innerHTML = visitors
                .map(
                    (v) =>
                        `<div class="user-row fade-up">
      <div class="user-row-info">
        <strong>${esc(v.nom)} ${esc(v.prenom)}</strong>
        <span>${esc(v.email)}</span>
      </div>
      <button type="button" class="btn btn-danger" data-email="${escAttr(v.email)}">Supprimer</button>
    </div>`
                )
                .join("");
            el.querySelectorAll("button[data-email]").forEach((btn) => {
                btn.onclick = function () {
                    deleteVisitor(btn.getAttribute("data-email"));
                };
            });
        } catch (e) {
            el.innerHTML = '<div class="alert alert-error">Erreur reseau.</div>';
            console.error(e);
        }
    }

    async function deleteVisitor(email) {
        if (!confirm("Supprimer ce visiteur ?")) return;
        try {
            const res = await apiFetch("/admin/visitors/" + encodeURIComponent(email), {
                method: "DELETE",
            });
            if (!res.ok) {
                alert(await parseError(res));
                return;
            }
            await renderAdminVisitors();
            await renderPending();
            await renderAdminAccounts();
        } catch (e) {
            console.error(e);
        }
    }

    function esc(str) {
        if (str == null) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function escAttr(str) {
        return esc(str).replace(/'/g, "&#39;");
    }

    function emptyState(msg) {
        return (
            '<div class="empty-state">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>' +
            "<p>" +
            esc(msg) +
            "</p></div>"
        );
    }

    function restoreSession() {
        const token = getToken();
        const role = localStorage.getItem("se_role");
        const email = localStorage.getItem("se_email") || "";
        if (token && role) {
            const display = email.includes("@") ? email.split("@")[0] : email;
            session = {
                loggedIn: true,
                role: role,
                email: email,
                nom: role === "admin" ? "Admin" : display,
                prenom: "",
            };
            afterLogin();
        }
    }

    window.navigate = navigate;

    restoreSession();
    navigate("accueil");
})();

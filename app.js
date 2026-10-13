
/*
  7K.SOCIAL
  Preencha SUPABASE_URL e SUPABASE_ANON_KEY
  com os dados do seu projeto Supabase.
*/

const SUPABASE_URL = "https://xtsporrgjlmoihvybqdi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yxbxKh_eH7Z02ZN3HFsnQA_k2po033b";

let db = null;
let currentUser = null;
let profile = null;

const $ = (id) => document.getElementById(id);

function showMessage(id, message) {
  $(id).textContent = message;
}

function setBusy(buttonId, busy, busyText = "AGUARDE...") {
  const button = $(buttonId);

  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = busyText;
  } else {
    button.textContent =
      button.dataset.originalText || button.textContent;
  }

  button.disabled = busy;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showApp(loggedIn) {
  $("authScreen").classList.toggle("hidden", loggedIn);
  $("appScreen").classList.toggle("hidden", !loggedIn);
  $("logoutBtn").classList.toggle("hidden", !loggedIn);
}

function showPage(page) {
  document.querySelectorAll(".page").forEach((section) => {
    section.classList.toggle("hidden", section.id !== page + "Page");
  });

  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  if (page === "feed") loadFeed();
  if (page === "profile") loadProfile();
}

async function loadProfile() {
  if (!currentUser) return;

  const { data, error } = await db
    .from("profiles")
    .select("id, nome, bio")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    showMessage("profileMessage", "Não foi possível carregar o perfil.");
    return;
  }

  profile = data;

  const name =
    data?.nome ||
    currentUser.user_metadata?.nome ||
    currentUser.email?.split("@")[0] ||
    "Usuário";

  $("welcomeName").textContent = name;
  $("profileName").value = data?.nome || "";
  $("profileBio").value = data?.bio || "";
  $("profileEmail").textContent = currentUser.email || "";
  $("avatar").textContent = name.slice(0, 2).toUpperCase();
}

async function loadFeed() {
  if (!currentUser || !db) return;

  const list = $("feedList");
  list.replaceChildren();

  const loading = document.createElement("p");
  loading.className = "muted";
  loading.textContent = "Carregando publicações...";
  list.appendChild(loading);

  const { data: posts, error } = await db
    .from("posts")
    .select("id, user_id, content, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    list.replaceChildren();
    const message = document.createElement("p");
    message.className = "message";
    message.textContent =
      "Não foi possível carregar o feed. Confira a configuração do banco.";
    list.appendChild(message);
    return;
  }

  if (!posts || posts.length === 0) {
    list.replaceChildren();
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Ainda não há publicações. Seja o primeiro a postar!";
    list.appendChild(empty);
    return;
  }

  const ids = posts.map((post) => post.id);
  const { data: likes, error: likesError } = await db
    .from("likes")
    .select("post_id, user_id")
    .in("post_id", ids);

  if (likesError) {
    list.replaceChildren();
    const message = document.createElement("p");
    message.className = "message";
    message.textContent = "Não foi possível carregar as curtidas.";
    list.appendChild(message);
    return;
  }

  const userIds = [...new Set(posts.map((post) => post.user_id))];

  const { data: profiles, error: profilesError } = await db
    .from("profiles")
    .select("id, nome")
    .in("id", userIds);

  if (profilesError) {
    list.replaceChildren();
    const message = document.createElement("p");
    message.className = "message";
    message.textContent = "Não foi possível carregar os autores.";
    list.appendChild(message);
    return;
  }

  const names = new Map((profiles || []).map((p) => [p.id, p.nome]));
  const allLikes = likes || [];

  list.replaceChildren();

  for (const post of posts) {
    const postLikes = allLikes.filter((like) => like.post_id === post.id);
    const liked = postLikes.some(
      (like) => like.user_id === currentUser.id
    );

    const card = document.createElement("article");
    card.className = "post";

    const header = document.createElement("div");
    header.className = "post-header";
    header.textContent = names.get(post.user_id) || "Usuário";

    const date = document.createElement("div");
    date.className = "post-date";
    date.textContent = new Date(post.created_at).toLocaleString("pt-BR");

    const content = document.createElement("div");
    content.className = "post-content";
    content.textContent = post.content;

    const actions = document.createElement("div");
    actions.className = "post-actions";

    const likeButton = document.createElement("button");
    likeButton.className = "like-btn";
    likeButton.textContent =
      `${liked ? "♥" : "♡"} Curtir (${postLikes.length})`;
    likeButton.setAttribute("aria-pressed", String(liked));
    likeButton.addEventListener("click", () => toggleLike(post.id, liked));

    actions.appendChild(likeButton);
    card.append(header, date, content, actions);
    list.appendChild(card);
  }
}

async function toggleLike(postId, alreadyLiked) {
  if (!currentUser) return;

  let result;

  if (alreadyLiked) {
    result = await db
      .from("likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", currentUser.id);
  } else {
    result = await db
      .from("likes")
      .insert({ post_id: postId, user_id: currentUser.id });
  }

  if (result.error) {
    alert("Não foi possível atualizar a curtida. Tente novamente.");
    return;
  }

  await loadFeed();
}

async function startSession(user) {
  currentUser = user;

  if (!user) {
    profile = null;
    showApp(false);
    return;
  }

  showApp(true);
  await loadProfile();
  await loadFeed();
}

async function initialize() {
  if (
    SUPABASE_URL === "COLE_A_URL_DO_PROJETO" ||
    SUPABASE_ANON_KEY === "COLE_A_CHAVE_PUBLICA"
  ) {
    showMessage(
      "authMessage",
      "Configure a URL e a chave pública do Supabase para começar."
    );
    return;
  }

  if (!window.supabase?.createClient) {
    showMessage("authMessage", "Não foi possível carregar o serviço de autenticação.");
    return;
  }

  db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  const { data, error } = await db.auth.getSession();

  if (error) {
    showMessage("authMessage", "Não foi possível verificar a sessão.");
    return;
  }

  await startSession(data.session?.user || null);

  db.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" ||
        event === "USER_UPDATED") {
      setTimeout(() => startSession(session?.user || null), 0);
    }
  });
}

$("registerBtn").addEventListener("click", async () => {
  if (!db) {
    showMessage("authMessage", "Configure o Supabase primeiro.");
    return;
  }

  const email = $("email").value.trim();
  const password = $("password").value;
  const nome = $("displayName").value.trim();

  if (!email || password.length < 6 || !nome) {
    showMessage("authMessage", "Informe e-mail, senha e nome. A senha deve ter pelo menos 6 caracteres.");
    return;
  }

  setBusy("registerBtn", true, "CRIANDO CONTA...");

  try {
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: {
        data: { nome }
      }
    });

    if (error) throw error;

    if (data.session) {
      showMessage("authMessage", "Conta criada!");
      await startSession(data.user);
    } else {
      showMessage(
        "authMessage",
        "Cadastro iniciado. Confira seu e-mail para confirmar a conta antes de entrar."
      );
    }
  } catch (error) {
    showMessage("authMessage", error.message || "Não foi possível criar a conta.");
  } finally {
    setBusy("registerBtn", false);
  }
});

$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!db) {
    showMessage("authMessage", "Configure o Supabase primeiro.");
    return;
  }

  setBusy("loginBtn", true, "ENTRANDO...");

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value
    });

    if (error) throw error;

    showMessage("authMessage", "Login realizado!");
    await startSession(data.user);
  } catch (error) {
    showMessage("authMessage", error.message || "Não foi possível entrar.");
  } finally {
    setBusy("loginBtn", false);
  }
});

$("logoutBtn").addEventListener("click", async () => {
  if (!db) return;

  const { error } = await db.auth.signOut();

  if (error) {
    alert("Não foi possível sair. Tente novamente.");
  } else {
    currentUser = null;
    showApp(false);
    showMessage("authMessage", "Você saiu da sua conta.");
  }
});

$("profileForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) return;

  const nome = $("profileName").value.trim();
  const bio = $("profileBio").value.trim();

  if (!nome) {
    showMessage("profileMessage", "Informe seu nome.");
    return;
  }

  const { error } = await db.from("profiles").upsert({
    id: currentUser.id,
    nome,
    bio
  });

  if (error) {
    showMessage("profileMessage", "Não foi possível salvar. Confira as políticas do banco.");
    return;
  }

  showMessage("profileMessage", "Perfil atualizado!");
  await loadProfile();
});

$("postForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) return;

  const content = $("postText").value.trim();

  if (!content) {
    showMessage("postMessage", "Escreva algo antes de publicar.");
    return;
  }

  setBusy("postForm", true);

  const { error } = await db.from("posts").insert({
    user_id: currentUser.id,
    content
  });

  setBusy("postForm", false);

  if (error) {
    showMessage("postMessage", "Não foi possível publicar. Confira o banco.");
    return;
  }

  $("postText").value = "";
  showMessage("postMessage", "Publicação enviada!");
  await loadFeed();
});

document.querySelectorAll(".nav-btn").forEach((button) => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

initialize();

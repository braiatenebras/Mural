// Elementos da interface
const formMensagem = document.getElementById("form-mensagem");
const mensagensContainer = document.getElementById("mensagens-container");
const loginRequired = document.getElementById("login-required");
const userInfo = document.getElementById("userInfo");
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const btnLoginPage = document.getElementById("btnLoginPage");
const userHeader = document.querySelector(".user-header");

// Atualiza header para admin
async function atualizarHeaderAdmin(user) {
    const userDoc = await db.collection("users").doc(user.uid).get();
    const role = userDoc.data()?.role || "user";

    const existingBtn = document.getElementById("btnAdminPanel");
    if (existingBtn) existingBtn.remove();

    if (role === "admin") {
        const btnAdmin = document.createElement("button");
        btnAdmin.id = "btnAdminPanel";
        btnAdmin.innerHTML = '<i class="fas fa-cog"></i>';
        btnAdmin.classList.add("botao-admin");
        btnAdmin.title = "Painel Admin";
        btnAdmin.addEventListener("click", () => {
            window.location.href = "admin/admin.html";
        });
        userHeader.appendChild(btnAdmin);
    }
}

// Checar login
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const userRef = db.collection("users").doc(user.uid);
        const doc = await userRef.get();

        if (!doc.exists) {
            await userRef.set({
                name: user.displayName || "Usuário",
                email: user.email,
                role: "user",
                photoURL: user.photoURL || "",
                tags: []
            });
        }

        const userPhoto = user.photoURL
            ? `<img src="${user.photoURL}" class="user-avatar" alt="Foto do perfil">`
            : '<i class="fas fa-user user-icon"></i>';

        userInfo.innerHTML = `${userPhoto} ${user.displayName || user.email}`;
        btnLogin.style.display = 'none';
        btnLogout.style.display = 'block';
        formMensagem.style.display = 'flex';
        loginRequired.style.display = 'none';

        await atualizarHeaderAdmin(user);
        carregarMensagens();
    } else {
        userInfo.textContent = "Visitante";
        btnLogin.style.display = 'block';
        btnLogout.style.display = 'none';
        formMensagem.style.display = 'none';
        loginRequired.style.display = 'block';
        mensagensContainer.innerHTML = "";
    }
});

async function adicionarMensagem(event) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) return alert('Você precisa estar logado para enviar mensagens!');

    const texto = document.getElementById("mensagem").value.trim();
    const arquivo = document.getElementById("imagem").files[0];

    if (!texto && !arquivo) {
        return alert('Digite uma mensagem ou selecione uma imagem!');
    }

    let imagemBase64 = '';

    if (arquivo) {
        if (arquivo.size > 1048576) {
            return alert('A imagem não pode ser maior que 1MB!');
        }

        imagemBase64 = await toBase64(arquivo);
    }

    db.collection("mensagens").add({
        uid: user.uid,
        nome: user.displayName || 'Usuário',
        email: user.email,
        photoURL: user.photoURL || '',
        texto: texto,
        imagemBase64: imagemBase64,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        formMensagem.reset();
        document.getElementById('image-preview').style.display = 'none';
    }).catch(error => {
        console.error("Erro ao enviar mensagem: ", error);
        alert("Erro ao enviar mensagem. Tente novamente.");
    });
}

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}


async function renderizarMensagem(doc) {
    const data = doc.data();
    const autorDoc = await db.collection("users").doc(data.uid).get();
    const autorData = autorDoc.data() || {};

    // Usar a photoURL do Firestore (que contém nossa imagem em base64)
    const fotoPerfil = autorData.photoURL || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';

    const autorIsAdmin = autorData.role === "admin";
    const autorTags = autorData.tags || [];

    const tagsHTML = autorTags
        .filter(tag => tag && tag.nome)
        .map(tag => `<span class="tag-admin" style="background-color:${tag.color || '#ff9800'}">${tag.nome.toUpperCase()}</span>`)
        .join(" ");

    const currentUser = auth.currentUser;
    let podeExcluir = false;
    if (currentUser) {
        const currentUserDoc = await db.collection("users").doc(currentUser.uid).get();
        const currentRole = currentUserDoc.data()?.role || "user";
        podeExcluir = (currentUser.uid === data.uid || currentRole === "admin");
    }

    const botaoExcluir = podeExcluir
        ? `<button class="excluir-btn" onclick="excluirMensagem('${doc.id}')"><i class="fas fa-trash"></i></button>`
        : '';

    const dataFormatada = data.timestamp ? new Date(data.timestamp.toDate()).toLocaleString('pt-BR') : 'Agora mesmo';
    const tagAdmin = autorIsAdmin ? '<span class="tag-admin">ADMIN</span>' : '';

    const imagemHTML = data.imagemBase64
        ? `<div class="mensagem-imagem"><img src="${data.imagemBase64}" alt="Imagem da mensagem" style="max-width: 100%; max-height: 300px; border-radius: 8px; margin-top: 10px;"></div>`
        : '';

    const mensagemDiv = document.createElement("div");
    mensagemDiv.classList.add("mensagem");
    mensagemDiv.id = doc.id;

    mensagemDiv.innerHTML = `
        <div class="mensagem-cabecalho">
            <img src="${fotoPerfil}" alt="Foto de perfil" class="foto-perfil">
            <div class="mensagem-info">
                <h3>${data.nome} ${tagAdmin} ${tagsHTML}</h3>
                <div class="email">${data.email}</div>
            </div>
            ${botaoExcluir}
        </div>
        <div class="texto">${data.texto}</div>
        ${imagemHTML}
        <div class="data">${dataFormatada}</div>
    `;

    mensagensContainer.appendChild(mensagemDiv);
}

function excluirMensagem(id) {
    if (confirm("Tem certeza que deseja excluir esta mensagem?")) {
        db.collection("mensagens").doc(id).delete()
            .then(() => console.log("Mensagem excluída com sucesso!"))
            .catch(error => {
                console.error("Erro ao excluir mensagem: ", error);
                alert("Erro ao excluir mensagem. Tente novamente.");
            });
    }
}
function carregarMensagens() {
    const user = auth.currentUser;
    if (!user) return;

    // Remover o filtro de "uid" para mostrar mensagens de todos os usuários
    db.collection("mensagens")
        .orderBy("timestamp", "desc") // Ordenar por data de envio, em ordem decrescente
        .onSnapshot(snapshot => {
            mensagensContainer.innerHTML = ""; // Limpa as mensagens anteriores
            snapshot.forEach(doc => renderizarMensagem(doc));
        }, error => {
            console.error("Erro ao carregar mensagens: ", error);
        });
}


// Event Listeners
formMensagem.addEventListener("submit", adicionarMensagem);
btnLogin.addEventListener("click", () => window.location.href = "conta/conta.html");
btnLoginPage.addEventListener("click", () => window.location.href = "conta/conta.html");
btnLogout.addEventListener("click", () => auth.signOut()
    .then(() => console.log("Usuário deslogado com sucesso"))
    .catch(error => {
        console.error("Erro ao fazer logout:", error);
        alert("Erro ao fazer logout. Tente novamente.");
    })
);

function previewImage(event) {
    const input = event.target;
    const preview = document.getElementById('preview');
    const imagePreview = document.getElementById('image-preview');

    if (input.files && input.files[0]) {
        const reader = new FileReader();

        reader.onload = function (e) {
            preview.src = e.target.result;
            imagePreview.style.display = 'block'; // Exibe o preview
        }

        reader.readAsDataURL(input.files[0]);
    }
}


// Remover imagem selecionada
function removeImage() {
    document.getElementById('imagem').value = '';
    document.getElementById('image-preview').style.display = 'none';
}

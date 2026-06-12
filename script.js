import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// Firebase 콘솔 > 프로젝트 설정 > 내 앱 > SDK 설정 및 구성에서 값을 복사해 넣으세요.
const firebaseConfig = {
  apiKey: "AIzaSyCUW991F28NzDdfzB4isy-2ahEz2DlY0aM",
  authDomain: "gwangju-lost-find.firebaseapp.com",
  projectId: "gwangju-lost-find",
  storageBucket: "gwangju-lost-find.firebasestorage.app",
  messagingSenderId: "239059483136",
  appId: "1:239059483136:web:72ba5b5ef8b85a77f976e5",
  measurementId: "G-0RHDNLG9HX"
};

const gwangjuDistricts = {
  "동구": ["충장동", "동명동", "계림동", "산수동", "지산동", "서남동", "학동", "지원동"],
  "서구": ["양동", "농성동", "광천동", "유덕동", "치평동", "상무동", "화정동", "서창동", "금호동", "풍암동", "동천동"],
  "남구": ["양림동", "방림동", "봉선동", "사직동", "월산동", "백운동", "주월동", "진월동", "효덕동", "송암동", "대촌동"],
  "북구": ["중흥동", "중앙동", "임동", "신안동", "용봉동", "운암동", "동림동", "우산동", "풍향동", "문화동", "문흥동", "두암동", "삼각동", "일곡동", "매곡동", "오치동", "석곡동", "건국동", "양산동", "신용동"],
  "광산구": ["송정동", "도산동", "신흥동", "어룡동", "우산동", "월곡동", "비아동", "첨단동", "신창동", "신가동", "수완동", "하남동", "임곡동", "동곡동", "평동", "삼도동", "본량동"]
};

const state = {
  posts: [],
  comments: [],
  selectedPostId: null,
  currentFilter: "all",
  searchQuery: "",
  firestoreReady: false,
  commentsUnsubscribe: null
};

const elements = {
  boardList: document.getElementById("boardList"),
  statusText: document.getElementById("statusText"),
  lostForm: document.getElementById("lostForm"),
  foundForm: document.getElementById("foundForm"),
  lostGu: document.getElementById("lostGu"),
  lostDong: document.getElementById("lostDong"),
  foundGu: document.getElementById("foundGu"),
  foundDong: document.getElementById("foundDong"),
  searchInput: document.getElementById("searchInput")
};

initPage();

function initPage() {
  initDistrictSelect(elements.lostGu);
  initDistrictSelect(elements.foundGu);
  bindEvents();
  connectFirebase();
}

function bindEvents() {
  elements.lostGu.addEventListener("change", () => updateDongSelect(elements.lostGu, elements.lostDong));
  elements.foundGu.addEventListener("change", () => updateDongSelect(elements.foundGu, elements.foundDong));
  elements.lostForm.addEventListener("submit", addLostPost);
  elements.foundForm.addEventListener("submit", addFoundPost);
  elements.boardList.addEventListener("click", handleBoardClick);
  elements.boardList.addEventListener("submit", handleBoardSubmit);
  elements.searchInput.addEventListener("input", handleSearchInput);

  document.querySelectorAll(".tab-btn").forEach((button) => {
    button.addEventListener("click", () => openTab(button.dataset.tab));
  });

  document.querySelectorAll(".filter-btn").forEach((button) => {
    button.addEventListener("click", () => filterBoard(button.dataset.filter));
  });
}

function initDistrictSelect(select) {
  Object.keys(gwangjuDistricts).forEach((gu) => {
    const option = document.createElement("option");
    option.value = gu;
    option.textContent = gu;
    select.appendChild(option);
  });
}

function updateDongSelect(guSelect, dongSelect) {
  const selectedGu = guSelect.value;
  dongSelect.innerHTML = '<option value="">동 선택</option>';

  if (!selectedGu) return;

  gwangjuDistricts[selectedGu].forEach((dong) => {
    const option = document.createElement("option");
    option.value = dong;
    option.textContent = dong;
    dongSelect.appendChild(option);
  });
}

function connectFirebase() {
  if (!isFirebaseConfigured()) {
    elements.statusText.textContent = "Firebase 설정 필요";
    elements.boardList.innerHTML = '<p class="error-msg">script.js의 firebaseConfig 값을 입력하면 게시판이 연결됩니다.</p>';
    return;
  }

  try {
    const app = initializeApp(firebaseConfig);
    state.db = getFirestore(app);
    state.postsRef = collection(state.db, "posts");
    state.firestoreReady = true;
    elements.statusText.textContent = "Firebase 연결 중";

    const postsQuery = query(state.postsRef, orderBy("createdAt", "desc"), limit(100));
    onSnapshot(
      postsQuery,
      (snapshot) => {
        state.posts = snapshot.docs.map((postDoc) => ({ id: postDoc.id, ...postDoc.data() }));
        elements.statusText.textContent = `게시글 ${state.posts.length}개`;

        if (state.selectedPostId && !state.posts.some((post) => post.id === state.selectedPostId)) {
          closeComments();
        }

        renderBoard();
      },
      (error) => {
        console.error(error);
        elements.statusText.textContent = "연결 오류";
        elements.boardList.innerHTML = '<p class="error-msg">Firebase 권한 또는 설정을 확인해주세요.</p>';
      }
    );
  } catch (error) {
    console.error(error);
    elements.statusText.textContent = "연결 오류";
    elements.boardList.innerHTML = '<p class="error-msg">Firebase 초기화에 실패했습니다.</p>';
  }
}

function isFirebaseConfigured() {
  return firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("여기에-");
}

async function addLostPost(event) {
  event.preventDefault();

  const reward = Number(document.getElementById("lostReward").value);
  const post = {
    kind: "lost",
    gu: elements.lostGu.value,
    dong: elements.lostDong.value,
    info: document.getElementById("lostInfo").value.trim(),
    reward
  };

  if (!post.gu || !post.dong || !post.info || Number.isNaN(reward)) {
    alert("모든 항목을 입력해주세요.");
    return;
  }

  if (reward < 0 || reward % 100 !== 0) {
    alert("사례금은 0원 이상, 100원 단위로 입력해주세요.");
    return;
  }

  await savePost(event.submitter, post, elements.lostForm, elements.lostGu, elements.lostDong);
}

async function addFoundPost(event) {
  event.preventDefault();

  const post = {
    kind: "found",
    gu: elements.foundGu.value,
    dong: elements.foundDong.value,
    type: document.getElementById("foundType").value.trim(),
    title: document.getElementById("foundTitle").value.trim(),
    content: document.getElementById("foundContent").value.trim()
  };

  if (!post.gu || !post.dong || !post.type || !post.title || !post.content) {
    alert("모든 항목을 입력해주세요.");
    return;
  }

  await savePost(event.submitter, post, elements.foundForm, elements.foundGu, elements.foundDong);
}

async function savePost(button, post, form, guSelect, dongSelect) {
  if (!state.firestoreReady) {
    alert("Firebase 설정을 먼저 입력해주세요.");
    return;
  }

  button.disabled = true;
  button.textContent = "등록 중...";

  try {
    await addDoc(state.postsRef, {
      ...post,
      createdAt: serverTimestamp()
    });

    form.reset();
    updateDongSelect(guSelect, dongSelect);
    openTab("board-tab");
  } catch (error) {
    console.error(error);
    alert("등록 중 오류가 발생했습니다. Firebase 권한을 확인해주세요.");
  } finally {
    button.disabled = false;
    button.textContent = "등록하기";
  }
}

function handleBoardClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const postId = button.closest(".card")?.dataset.postId;
  if (!postId) return;

  if (button.dataset.action === "toggle-comments") {
    toggleComments(postId);
  }

  if (button.dataset.action === "delete-post") {
    deletePost(postId);
  }
}

function handleBoardSubmit(event) {
  if (!event.target.matches(".comment-form")) return;
  event.preventDefault();
  addComment(event.target);
}

function toggleComments(postId) {
  if (state.selectedPostId === postId) {
    closeComments();
    renderBoard();
    return;
  }

  openComments(postId);
}

function openComments(postId) {
  if (!state.firestoreReady) {
    alert("Firebase 설정을 먼저 확인해주세요.");
    return;
  }

  closeComments();
  state.selectedPostId = postId;
  state.comments = [];
  renderBoard();

  const commentsRef = collection(state.db, "posts", postId, "comments");
  const commentsQuery = query(commentsRef, orderBy("createdAt", "asc"), limit(100));
  state.commentsUnsubscribe = onSnapshot(
    commentsQuery,
    (snapshot) => {
      state.comments = snapshot.docs.map((commentDoc) => ({ id: commentDoc.id, ...commentDoc.data() }));
      renderBoard();
    },
    (error) => {
      console.error(error);
      state.comments = [];
      alert("댓글을 불러오지 못했습니다. Firebase 권한을 확인해주세요.");
      renderBoard();
    }
  );
}

function closeComments() {
  if (state.commentsUnsubscribe) {
    state.commentsUnsubscribe();
  }

  state.commentsUnsubscribe = null;
  state.selectedPostId = null;
  state.comments = [];
}

async function addComment(form) {
  const postId = form.dataset.postId;
  const input = form.querySelector("textarea");
  const button = form.querySelector("button");
  const content = input.value.trim();

  if (!content) {
    alert("댓글 내용을 입력해주세요.");
    return;
  }

  button.disabled = true;
  button.textContent = "등록 중...";

  try {
    await addDoc(collection(state.db, "posts", postId, "comments"), {
      content,
      createdAt: serverTimestamp()
    });
    form.reset();
  } catch (error) {
    console.error(error);
    alert("댓글 등록 중 오류가 발생했습니다. Firebase 권한을 확인해주세요.");
  } finally {
    button.disabled = false;
    button.textContent = "댓글 등록";
  }
}

async function deletePost(postId) {
  if (!state.firestoreReady) {
    alert("Firebase 설정을 먼저 확인해주세요.");
    return;
  }

  const post = state.posts.find((item) => item.id === postId);
  if (!post) return;

  const ok = confirm("이 게시글과 댓글을 삭제할까요?");
  if (!ok) return;

  try {
    const commentsRef = collection(state.db, "posts", postId, "comments");
    const commentsSnapshot = await getDocs(commentsRef);
    await Promise.all(commentsSnapshot.docs.map((commentDoc) => deleteDoc(commentDoc.ref)));
    await deleteDoc(doc(state.db, "posts", postId));

    if (state.selectedPostId === postId) {
      closeComments();
    }
  } catch (error) {
    console.error(error);
    alert("삭제 중 오류가 발생했습니다. Firebase 권한을 확인해주세요.");
  }
}

function openTab(tabId) {
  document.querySelectorAll(".tab-content").forEach((tab) => tab.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabId);
  });

  document.getElementById(tabId).classList.add("active");
}

function filterBoard(type) {
  state.currentFilter = type;
  document.querySelectorAll(".filter-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === type);
  });
  renderBoard();
}

function handleSearchInput(event) {
  state.searchQuery = event.target.value.trim().toLowerCase();
  renderBoard();
}

function renderBoard() {
  const filteredPosts = state.posts.filter((post) => {
    const matchesType = state.currentFilter === "all" || post.kind === state.currentFilter;
    const matchesSearch = !state.searchQuery || getPostSearchText(post).includes(state.searchQuery);
    return matchesType && matchesSearch;
  });

  if (filteredPosts.length === 0) {
    const message = state.searchQuery
      ? `"${escapeHtml(state.searchQuery)}" 검색 결과가 없습니다.`
      : "등록된 게시글이 없습니다.";
    elements.boardList.innerHTML = `<p class="empty-msg">${message}</p>`;
    return;
  }

  elements.boardList.innerHTML = filteredPosts.map(renderPostCard).join("");
}

function getPostSearchText(post) {
  if (post.kind === "lost") {
    return [post.gu, post.dong, post.info].join(" ").toLowerCase();
  }

  return [post.gu, post.dong, post.type, post.title, post.content].join(" ").toLowerCase();
}

function renderPostCard(post) {
  const dateText = formatDate(post.createdAt);
  const isOpen = state.selectedPostId === post.id;
  const commentButtonText = isOpen ? "댓글 닫기" : "댓글 보기";
  const commentsPanel = isOpen ? renderCommentsPanel(post.id) : "";

  if (post.kind === "lost") {
    return `
      <article class="card lost" data-post-id="${escapeHtml(post.id)}">
        <div class="card-topline">
          <span class="card-badge">분실</span>
          <div class="card-actions">
            <button type="button" class="small-btn" data-action="toggle-comments">${commentButtonText}</button>
            <button type="button" class="small-btn danger-btn" data-action="delete-post">삭제</button>
          </div>
        </div>
        <h3>광주광역시 ${escapeHtml(post.gu)} ${escapeHtml(post.dong)}</h3>
        <p><strong>설명:</strong> ${escapeHtml(post.info)}</p>
        <p class="reward">사례금 ${Number(post.reward || 0).toLocaleString()}원</p>
        <small>등록일: ${dateText}</small>
        ${commentsPanel}
      </article>
    `;
  }

  return `
    <article class="card found" data-post-id="${escapeHtml(post.id)}">
      <div class="card-topline">
        <span class="card-badge">습득</span>
        <div class="card-actions">
          <button type="button" class="small-btn" data-action="toggle-comments">${commentButtonText}</button>
          <button type="button" class="small-btn danger-btn" data-action="delete-post">삭제</button>
        </div>
      </div>
      <h3>[${escapeHtml(post.type)}] ${escapeHtml(post.title)}</h3>
      <p><strong>습득 장소:</strong> 광주광역시 ${escapeHtml(post.gu)} ${escapeHtml(post.dong)}</p>
      <p><strong>상세 내용:</strong> ${escapeHtml(post.content)}</p>
      <small>등록일: ${dateText}</small>
      ${commentsPanel}
    </article>
  `;
}

function renderCommentsPanel(postId) {
  const commentsHtml = state.comments.length === 0
    ? '<p class="empty-comments">아직 댓글이 없습니다.</p>'
    : state.comments.map(renderComment).join("");

  return `
    <section class="comments-panel" aria-label="댓글 영역">
      <h4>댓글</h4>
      <div class="comments-list">${commentsHtml}</div>
      <form class="comment-form" data-post-id="${escapeHtml(postId)}">
        <textarea name="comment" rows="3" maxlength="300" placeholder="댓글을 입력하세요." required></textarea>
        <button type="submit" class="comment-submit">댓글 등록</button>
      </form>
    </section>
  `;
}

function renderComment(comment) {
  return `
    <div class="comment-item">
      <p>${escapeHtml(comment.content)}</p>
      <small>${formatDate(comment.createdAt)}</small>
    </div>
  `;
}

function formatDate(timestamp) {
  if (!timestamp || !timestamp.toDate) return "방금 전";
  return timestamp.toDate().toLocaleString("ko-KR");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}



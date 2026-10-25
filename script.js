// 保存データを管理するキー
const STORAGE_KEY = "rubiks_cube_solves";

// 保存済みの記録を読み込む
function loadSolves() {
    try {
        const savedData = localStorage.getItem(STORAGE_KEY);

        if (!savedData) {
            return [];
        }

        const parsedData = JSON.parse(savedData);

        // 保存データが配列でなければ初期化する
        return Array.isArray(parsedData) ? parsedData : [];
    } catch (error) {
        console.error("記録の読み込みに失敗しました:", error);
        return [];
    }
}

// 記録をブラウザに保存する
function saveSolves() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(solves));
    } catch (error) {
        console.error("記録の保存に失敗しました:", error);
        alert("記録を保存できませんでした。ブラウザの保存容量などを確認してください。");
    }
}
const timerDisplay = document.getElementById("timer");
const timerButton = document.getElementById("timerButton");
const statusDisplay = document.getElementById("status");
const pbDisplay = document.getElementById("pb");
const solveCountDisplay = document.getElementById("solveCount");
const historyList = document.getElementById("history");
const rankingList = document.getElementById("rankingList");
const rankingEmpty = document.getElementById("rankingEmpty");

const averageDisplays = {
    mo3: document.getElementById("mo3"),
    ao5: document.getElementById("ao5"),
    ao12: document.getElementById("ao12"),
    ao50: document.getElementById("ao50"),
    ao100: document.getElementById("ao100")
};

const emptyMessage = document.querySelector(".empty-message");

let running = false;
let startedAt = 0;
let animationId = null;
// Supabase 接続設定
const SUPABASE_URL = "https://vhswktrglidvrgexndhh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_H1Nie2xgxN9Kbhzc0zVPKA_mFFH_2Tu";

// Supabase クライアントを作成
const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);
let solves = loadSolves();

function formatTime(milliseconds) {
    return (milliseconds / 1000).toFixed(2);
}

function renderTimer() {
    if (!running) return;

    const elapsed = performance.now() - startedAt;
    timerDisplay.textContent = formatTime(elapsed);
    animationId = requestAnimationFrame(renderTimer);
}

function startTimer() {
    if (running) return;

    running = true;
    startedAt = performance.now();

    timerButton.textContent = "STOP SOLVE";
    statusDisplay.textContent = "SOLVING...";
    statusDisplay.style.color = "#51e0cf";

    animationId = requestAnimationFrame(renderTimer);
}

function stopTimer() {
    if (!running) return;

    const elapsed = performance.now() - startedAt;

    running = false;
    cancelAnimationFrame(animationId);

    timerDisplay.textContent = formatTime(elapsed);
    timerButton.textContent = "START SOLVE";
    statusDisplay.textContent = "SOLVE COMPLETED";
    statusDisplay.style.color = "#8b7cff";

    saveSolve(elapsed);
}

async function saveSolve(milliseconds) {
    const { data: { session } } =
        await supabaseClient.auth.getSession();

    // ログインしていない場合は、今までどおりブラウザに保存
    if (!session) {
        const solve = {
            time: milliseconds,
            date: new Date().toISOString()
        };

        solves.unshift(solve);
        saveSolves();
        renderHistory();
        return;
    }

    // ログイン中はSupabaseに保存
    const { data, error } = await supabaseClient
        .from("cube_solves")
        .insert({
            time_ms: milliseconds,
            solved_at: new Date().toISOString()
        })
        .select("id, time_ms, solved_at")
        .single();

    if (error) {
        console.error("クラウドへの記録保存に失敗しました:", error.message);
        alert("クラウドに記録を保存できませんでした。もう一度ログイン状態を確認してください。");
        return;
    }

    // 保存した記録を画面に反映
    solves.unshift({
        id: data.id,
        time: data.time_ms,
        date: data.solved_at
    });

    renderHistory();
}

function renderHistory() {
    historyList.replaceChildren();
    emptyMessage.hidden = solves.length > 0;

    const best = solves.length
        ? Math.min(...solves.map(solve => solve.time))
        : null;

    pbDisplay.textContent = best === null
        ? "--.--"
        : formatTime(best);

    solveCountDisplay.textContent = solves.length;

    solves.slice(0, 10).forEach((solve, index) => {
        const item = document.createElement("li");
        const time = document.createElement("span");
        const date = document.createElement("span");
        const deleteButton = document.createElement("button");

        time.className = "record-time";
        date.className = "record-date";

        time.textContent = `${formatTime(solve.time)} 秒`;

        date.textContent = new Date(solve.date).toLocaleString(
            "ja-JP",
            {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false
            }
        );


        if (solve.time === best) {
            time.textContent += " 🏆";
        }

        deleteButton.textContent = "🗑";
        deleteButton.className = "delete-button";
        deleteButton.type = "button";
        deleteButton.title = "この記録を削除";
        deleteButton.setAttribute("aria-label", `${formatTime(solve.time)}秒の記録を削除`);

       deleteButton.addEventListener("click", async () => {
            const confirmed = confirm(
                `${formatTime(solve.time)}秒の記録を削除しますか？\nこの操作は取り消せません。`
            );

            if (!confirmed) return;

            // 元の記録の位置を特定して削除する
            // ログイン中で、クラウドに保存された記録なら先に削除
            if (solve.id !== undefined && solve.id !== null) {
                const { data: { session } } =
                    await supabaseClient.auth.getSession();

                if (session) {
                    const { error } = await supabaseClient
                        .from("cube_solves")
                        .delete()
                        .eq("id", solve.id);

                    if (error) {
                        console.error("クラウド記録の削除に失敗しました:", error.message);
                        alert("クラウドの記録を削除できませんでした。");
                        return;
                    }
                }
            }

            solves.splice(solves.indexOf(solve), 1);

            // ログアウト中は、今までどおりブラウザに保存
            if (!solves.some(item => item.id !== undefined && item.id !== null)) {
                saveSolves();
            }

            renderHistory();
        });

        item.append(time, date, deleteButton);
        historyList.appendChild(item);
    });
    renderRanking();
    renderAverageStats();
}

function toggleTimer() {
    if (running) {
        stopTimer();
    } else {
        startTimer();
    }
}

timerButton.addEventListener("click", toggleTimer);

document.addEventListener("keydown", event => {
    if (event.code !== "Space" || event.repeat) return;

    event.preventDefault();

    if (event.target === timerButton) return;

    toggleTimer();
});

function renderRanking() {
    // 全記録をタイムの速い順に並べる
    // 元の配列を変更しないようにコピーする
    const rankedSolves = solves
        .map((solve, originalIndex) => ({
            ...solve,
            originalIndex
        }))
        .sort((a, b) => {
            return a.time - b.time ||
                a.originalIndex - b.originalIndex;
        });

    rankingList.replaceChildren();
    rankingEmpty.hidden = rankedSolves.length > 0;

    rankedSolves.forEach((solve, index) => {
        const item = document.createElement("li");
        const position = document.createElement("span");
        const details = document.createElement("div");
        const time = document.createElement("span");
        const date = document.createElement("span");

        item.className = "ranking-item";
        position.className = "ranking-position";
        details.className = "ranking-details";
        time.className = "ranking-time";
        date.className = "ranking-date";

        // 同タイムでも別記録として順位を付ける
        position.textContent = `${index + 1}位`;

        time.textContent = `${formatTime(solve.time)} 秒`;

        date.textContent = new Date(solve.date).toLocaleString(
            "ja-JP",
            {
                year: "numeric",
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

        if (index === 0) {
            time.textContent += " 🏆";
        }

        details.append(time, date);
        item.append(position, details);
        rankingList.appendChild(item);
    });
}

/**
 * 指定した回数の平均タイムを計算する
 * Mo3: 除外なし
 * Ao5/Ao12: 最速1回・最遅1回を除外
 * Ao50: 最速3回・最遅3回を除外
 * Ao100: 最速5回・最遅5回を除外
 */
function calculateAverage(count, trimCount) {
    // 新しい記録から指定回数を取得する
    const recentSolves = solves.slice(0, count);

    // 必要な回数がそろっていなければ計算しない
    if (recentSolves.length < count) {
        return null;
    }

    // タイムの速い順に並べ替える
    const sortedTimes = recentSolves
        .map(solve => solve.time)
        .sort((a, b) => a - b);

    // 最速・最遅の記録を除外する
    const keptTimes = sortedTimes.slice(
        trimCount,
        sortedTimes.length - trimCount
    );

    // 残った記録の平均を返す
    const total = keptTimes.reduce((sum, time) => sum + time, 0);
    return total / keptTimes.length;
}

/**
 * 5種類の平均タイムを画面に反映する
 */
function renderAverageStats() {
    const averageSettings = [
        { key: "mo3", count: 3, trim: 0 },
        { key: "ao5", count: 5, trim: 1 },
        { key: "ao12", count: 12, trim: 1 },
        { key: "ao50", count: 50, trim: 3 },
        { key: "ao100", count: 100, trim: 5 }
    ];

    averageSettings.forEach(setting => {
        const average = calculateAverage(setting.count, setting.trim);
        const display = averageDisplays[setting.key];

        display.textContent = average === null
            ? "--.--"
            : formatTime(average);
    });
}


renderHistory();
// Supabase 接続テスト
console.log(
    "Supabase client:",
    typeof supabaseClient !== "undefined"
        ? "初期化成功"
        : "初期化失敗"
);

/* ヘッダーのログイン・新規登録ポップアップ */
const authModal = document.getElementById("auth-modal");
const authModalTitle = document.getElementById("auth-modal-title");
const authSubmitButton = document.getElementById("auth-submit-button");
const authMessage = document.getElementById("auth-message");

let authMode = "login";

function openAuthModal(mode) {
    authMode = mode;

    const isSignup = mode === "signup";

    authModalTitle.textContent = isSignup ? "新規登録" : "ログイン";
    authSubmitButton.textContent = isSignup ? "新規登録" : "ログイン";
    authMessage.textContent = "";

    document.getElementById("auth-password").value = "";
    document.getElementById("auth-password").autocomplete =
        isSignup ? "new-password" : "current-password";

    authModal.hidden = false;
}

document.getElementById("header-login-button").addEventListener("click", () => {
    openAuthModal("login");
});

document.getElementById("header-signup-button").addEventListener("click", () => {
    openAuthModal("signup");
});

document.getElementById("auth-modal-close").addEventListener("click", () => {
    authModal.hidden = true;
});

authModal.addEventListener("click", (event) => {
    if (event.target === authModal) {
        authModal.hidden = true;
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !authModal.hidden) {
        authModal.hidden = true;
    }
});
/* 新規登録・ログイン処理 */
authSubmitButton.addEventListener("click", async () => {
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;

    authMessage.textContent = "";

    if (!email || !password) {
        authMessage.textContent = "メールアドレスとパスワードを入力してください。";
        return;
    }

    authSubmitButton.disabled = true;
    authMessage.textContent = "処理中...";

    try {
        if (authMode === "signup") {
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    emailRedirectTo:
                        window.location.origin + window.location.pathname
                }
            });

            if (error) throw error;

            if (data.session) {
                authMessage.textContent = "新規登録が完了しました！";
            } else {
                authMessage.textContent =
                    "登録を受け付けました。確認メールが届いたら、メール内のリンクを開いてください。";
            }
        } else {
            const { error } =
                await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });

            if (error) throw error;

            authMessage.textContent = "ログインしました！";
        }

        document.getElementById("auth-password").value = "";
    } catch (error) {
        authMessage.textContent =
            "エラー：" + error.message;
    } finally {
        authSubmitButton.disabled = false;
    }
});
/* ログイン状態の表示 */
const headerLoginButton = document.getElementById("header-login-button");
const headerSignupButton = document.getElementById("header-signup-button");
const headerLogoutButton = document.getElementById("header-logout-button");

function updateAuthUI(session) {
    const isLoggedIn = Boolean(session);

    headerLoginButton.hidden = isLoggedIn;
    headerSignupButton.hidden = isLoggedIn;
    headerLogoutButton.hidden = !isLoggedIn;
}

async function initializeAuthUI() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
        console.error("ログイン状態の取得に失敗しました:", error.message);
        return;
    }

    updateAuthUI(data.session);
}

initializeAuthUI();

supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    updateAuthUI(session);

    if (session) {
        await loadCloudSolves();
    } else {
        solves = loadSolves();
        renderHistory();
    }
});

/* Supabaseから記録を読み込む */
async function loadCloudSolves() {
    const { data: { session } } =
        await supabaseClient.auth.getSession();

    if (!session) return;

    const { data, error } = await supabaseClient
        .from("cube_solves")
        .select("id, time_ms, solved_at")
        .order("solved_at", { ascending: false });

    if (error) {
        console.error("クラウド記録の読み込みに失敗しました:", error.message);
        alert("クラウド記録を読み込めませんでした。");
        return;
    }

    solves = data.map(row => ({
        id: row.id,
        time: row.time_ms,
        date: row.solved_at
    }));

    renderHistory();
}

/* ログアウト */
headerLogoutButton.addEventListener("click", async () => {
    headerLogoutButton.disabled = true;

    try {
        const { error } = await supabaseClient.auth.signOut();

        if (error) throw error;

        authModal.hidden = true;
    } catch (error) {
        alert("ログアウトに失敗しました：" + error.message);
    } finally {
        headerLogoutButton.disabled = false;
    }
});
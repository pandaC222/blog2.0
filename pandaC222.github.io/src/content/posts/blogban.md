---
title: "自用板子"
published: 2026-04-05T14:42:00+08:00
description: "一直更新"
image: /assets/home/acm.webp
tags: [算法,模板]
category: 模板
---

# 1	基础算法

## 1.1	头文件

~~~cpp
#include<bits/stdc++.h>
using namespace std;
#define debug(x) cerr << #x << ": " << x << "\n";
using i64 = long long;
using i128 = __int128;
using ld = long double;
const i64 INF = 0x3f3f3f3f3f3f3f3f;
const i64 mod = 998244353;
void solve(){
    
}
int main(){
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(nullptr);
    int t = 1;
    cin >> t;
    while(t--){
        solve();
    }return 0;
}
~~~

## 1.2	常用函数

### 1.2.1	组合数预处理

~~~cpp
#include<bits/stdc++.h>
using namespace std;
using i64 = long long;
using i128 = __int128;
const i64 INF = 0x3f3f3f3f3f3f3f3f;
const i64 mod = 998244353;
const int mx = 1e6 + 1000; 
i64 fac[mx + 1], invfac[mx + 1];
i64 fastpow(i64 x, i64 p) {
    i64 ans = 1;
    x %= mod;
    while (p) {
        if (p & 1) ans = ans * x % mod;
        x = x * x % mod;
        p >>= 1;
    }
    return ans;
}
i64 inv(i64 x) {
    return fastpow(x, mod - 2);
}
i64 c(i64 a, i64 b) {
    if(b < 0 || b > a) return 0;
    return fac[a] * invfac[b] % mod * invfac[a - b] % mod;
}

void init() {
    fac[0] = 1;
    for (int i = 1; i <= mx; i++) {
        fac[i] = fac[i - 1] * i % mod;
    }
    invfac[mx] = fastpow(fac[mx], mod - 2);
    for (int i = mx - 1; i >= 1; i--) {
        invfac[i] = invfac[i + 1] * (i + 1) % mod;
    }
}

void solve() {

}
int main(){
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(nullptr);   
    init();
    int t = 1;
    cin >> t;
    while (t--) {
        solve();
    }
    return 0;
}
~~~

### 1.2.2	整数二分

~~~cpp
int find(x){
    int l = 0, r = n + 1;
    while(l + 1 < r){
        int mid = l + r >> 1;
        if(a[mid] <= q) l = mid;
        else r = mid;
    }
    return l;
}
~~~

### 1.2.3	浮点数二分

~~~cpp
ld find(ld x){
    ld l = -100, r = 100;
    while(r - l > 1e-5){
        ld mid = (l + r)/2;
        if(check(mid)) l = mid;
        else r = mid;
    }
    return l;
}
~~~

###  1.2.3 	判断素数

~~~cpp
bool isprime(int x) {
    if (x == 1) return false;
    for (int i = 2; i * i <= x; ++i)
        if (x % i == 0)
            return false;
    return true;
}
~~~



# 2	数论

## 2.1	线性筛素数

### 2.1.1	埃式筛

 埃氏筛的时间复杂度为 O(nloglogn)，在处理 1e7 以内的数据量时表现非常出色。 

~~~cpp
const int N = 1e8 + 10;
bitset<N> isprime;
vector<int> prime;
void sieve() {
    isprime.set();
    isprime[0] = isprime[1] = 0;
    for (int i = 2; i < N; ++i) {
        if (isprime[i]) {
            prime.push_back(i);
            if ((i64)i * i < N) {
                for (int j = i * i; j < N; j += i) {
                    isprime[j] = 0;
                }
            }
        }
    }
}
~~~

### 2.1.2	欧拉筛(线性筛)

~~~cpp
const int N = 1e6 + 10;
bitset<N> isprime;
vector<int> prime;
void sieve() {
    isprime.set();
    isprime[0] = isprime[1] = 0;
    for (int i = 2; i < N; ++i) {
        if (isprime[i]) prime.push_back(i);
        for (int p : prime) {
            if (1LL * i * p >= N) break;
            isprime[i * p] = 0;
            if (i % p == 0) break;
        }
    }
}
~~~

## 2.2	费马小定理

 若 p为质数，且a,p 互质，则 𝑎𝑝−1 ≡1(𝑚𝑜𝑑 𝑝)

 𝑎 ∗𝑎𝑝−2 = 𝑎𝑝−1 ≡ 1(𝑚𝑜𝑑 𝑝)

 所以快速幂求 a 模意义下的逆元就是 qpow(a,mod-2) 只适用于 p 为质数

## 2.3	 裴蜀定理 

 对于一个二元一次方程*ax*+*by*=*c*，如果 **c是gcd(a,b)的倍数**，那么**这个方程一定有整数解** 

 对于一个 **n元一次不定方程** *a*1*x*1+*a*2*x*2+*a*3*x*3+⋯+*a**n**xn*=*c*，*c*是gcd(*a*1,*a*2,*a*3,⋯,*an*)的倍数，是这个方程有整数解的充要条件 

## 2.4	快速幂

~~~cpp
i64 qpow(i64 x, i64 p) {
    x %= mod;
    i64 res = 1;
    while(p) {
        if(p & 1) res = res * x % mod;
        x = x * x % mod;
        p >>= 1;
    }
    return res;
}
~~~

## 2.5	求逆元

p需要是质数

~~~cpp
int getinv(int x,int p){
    return qpow(x,p - 2)
}
~~~

## 2.6	扩展欧几里得

待补充

~~~cpp
int exgcd(int a,int b,int &x,int &y){
    if(b==0){
        x=1,y=0;
        return a;
    }
    int x1,y1,d;
    d=exgcd(b,a%b,x1,y1);
    x=y1,y=x1-a/b*y1;
    return d;
}
~~~



## 2.7	矩阵快速幂



~~~cpp
int n;  // 全局 n，但需要确保每组数据都正确设置
i64 k;
struct matrix {
    i64 c[101][101];
    matrix() { memset(c, 0, sizeof(c)); }
} res, a;
// 重载运算符 - 使用全局 n
matrix operator*(const matrix& x, const matrix& y) {
    matrix t;
    for (int i = 1; i <= n; i++) {
        for (int k = 1; k <= n; k++) {
            if (x.c[i][k] == 0) continue;  // 优化
            for (int j = 1; j <= n; j++) {
                t.c[i][j] = (t.c[i][j] + x.c[i][k] * y.c[k][j]) % mod;
            }
        }
    }
    return t;
}
void fastpow(i64 k) {
    // 重置并初始化为单位矩阵
    memset(res.c, 0, sizeof(res.c));
    for (int i = 1; i <= n; i++) res.c[i][i] = 1;
    // 注意：需要复制 a，因为 a 会被修改
    matrix base = a;
    while (k) {
        if (k & 1) res = res * base;
        base = base * base;
        k >>= 1;
    }
}

void solve() {
    cin >> n >> k;
    // 读入矩阵 a
    for (int i = 1; i <= n; i++) {
        for (int j = 1; j <= n; j++) {
            cin >> a.c[i][j];
        }
    }
    fastpow(k);
    // 输出结果
    for (int i = 1; i <= n; i++) {
        for (int j = 1; j <= n; j++) {
            cout << res.c[i][j] << " \n";
        }
    }
}
~~~



# 3	图论

## 3.1	 单源最短路径 

### 3.1.1	 Djikstra算法 

~~~cpp
void solve(){
    int n, m, s;
    cin >> n >> m >> s;
    vector<int> dist(n + 1, 1e9);
    vector<vector<array<int, 2>>> e(n + 1);
    dist[s] = 0;
    for(int i = 1;i <= m; ++i){
        int u, v, w;
        cin >> u >> v >> w;
        e[u].push_back({v, w});
    }
    priority_queue<array<int, 2>, vector<array<int, 2>>, greater<>> q;
    q.push({0, s});
    while(q.size()){
        auto [d, u] = q.top();
        q.pop();
        if(d > dist[u]) continue;
        for(auto [v, w] : e[u]){
            if(d + w < dist[v]){
                dist[v] = d + w;
                q.push({dist[v], v});
            }
        }
    }
    for(int i = 1;i <= n; ++i) cout << dist[i] << " ";
}
~~~

## 3.2	 最小生成树 

在一个带权无向图中
找一棵权值和最小的生成树 

1 所有点都连通
2 没有环
3 有 n-1 条边 

### 3.2.1	 Prim算法 O(m log n)

 Prim的核心思想:  每次选择连接已选点集合 和 未选点集合之间的最小边 ,直到连接n个点

~~~cpp
const int N = 202020;
bool vis[N];
vector<array<int, 2>> e[N];
void solve(){
    int n, m;
    cin >> n >> m;
    for(int i = 1;i <= m; ++i){
        int u, v, w;
        cin >> u >> v >> w;
        e[u].push_back({v, w});
        e[v].push_back({u, w});
    }
    priority_queue<array<int, 2>, vector<array<int, 2>>, greater<>> q;
    int ans = 0, cnt = 0;
    q.push({0, 1});
    while(q.size() && cnt < n){
        auto [w, u] = q.top();
        q.pop();
        if(vis[u]) continue;
        ans += w;
        cnt++;
        vis[u] = 1;
        for(auto [v, ww] : e[u]){
            if(!vis[v]) q.push({ww, v});
        }
    }
    if(cnt == n) cout << ans << "\n";
    else cout << "orz\n";
}
~~~

## 3.2.2	 Kruskal 算法  O(m log m) 

 Kruskal 算法核心思想 ： 每次选当前最小的边，只要不形成环就加入 ，直到 选了 n-1 条边 

 因为 **树一定有 n-1 条边**。  这个算法是 **贪心算法**：每一步都选当前最小的边。 

~~~cpp
const int N = 202020;
int fa[N];
void init(){
    for(int i = 1;i < N; ++i) fa[i] = i;
}
int find(int x){
    if(fa[x] == x) return x;
    return fa[x] = find(fa[x]);
}
void merge(int u, int v){
    int fu = find(u), fv = find(v);
    if(fu != fv){
        fa[fu] = fv;
    }
}
bool same(int u, int v){
    return find(u) == find(v);
}
void solve(){
    init();
    int n, m;
    cin >> n >> m;
    vector<array<int, 3>> e(m + 1);
    for(int i = 1;i <= m; ++i){
        cin >> e[i][0] >> e[i][1] >> e[i][2];
    }
    sort(e.begin() + 1, e.end(), [](array<int, 3> a, array<int, 3> b){
        return a[2] < b[2];
    });
    int cnt = 0, ans = 0;
    for(auto [u, v, w] : e){
        if(!same(u, v)){
            merge(u, v);
            cnt++;
            ans += w;
        }
        if(cnt == n - 1) break;
    }
    if(cnt == n - 1){
        cout << ans << "\n";
    }
    else cout << "orz\n";
}
~~~

## 3.3	拓扑排序

拓扑排序是一个有向无环图的所有顶点的线性序列。

该序列需要满足每个顶点出现且**只出现一次**和如果有一条 *A* 到 *B* 的路径，在序列中 *A* 出现在 *B* 的前面。

拓扑排序的步骤：

- 计算每个点的入度。
- 入度为 0 就加入队列。
- 当队列不为空则循环：
  - 取出队首元素并输出。
  - 遍历队首元素的连边，对应节点的入度 −1。
  - 当对应的节点入度为 0 就加入队列。

~~~cpp
void solve(){
    int n; cin >> n;
    vector<int> deg(n + 1);          // 入度数组
    vector<vector<int>> e(n + 1);   // 邻接表
    for(int i = 1; i <= n; i++){
        int x;
        while(cin >> x){
            if(x == 0) break;
            e[i].push_back(x);      // 建图
            deg[x]++;               // 统计入度
        }
    }
    queue<int> q;
    for(int i = 1; i <= n; i++){
        if(!deg[i]) q.push(i);      // 入度为 0 的点入队
    }
    while(q.size()){
        int t = q.front(); q.pop();
        cout << t << " ";           // 输出/记录拓扑序
        for(auto i : e[t]){
            deg[i]--;               // 删边：终点入度减 1
            if(!deg[i]) q.push(i);  // 新入度为 0 的点入队
        }
    }
}
~~~

# 4	数据结构

## 4.1	并查集

 merge时将size小的往size大的上面合并有利于降低树高 

使用sz时需要判断是不是代表点(fa[x]==x)

~~~cpp
const int N = 2e5+10;
int fa[N],sz[N];
void init(){
    for(int i = 1; i < N; i++){
        fa[i] = i;
        sz[i] = 1;
    }
}
int find(int x){
    if(fa[x] == x) return x;
    return fa[x] = find(fa[x]);
}
void merge(int x,int y){
    int fx = find(x),fy = find(y);
    if(fx != fy){
        if(sz[fx] >= sz[fy]){
            fa[fy] = fx;
            sz[fx] += sz[fy];
        }
        else{
            fa[fx] = fy;
            sz[fy] += sz[fx];
        }
    }
}
bool same(int u, int v){
    return find(u) == find(v);
}
~~~

## 4.2	中序遍历+前后序遍历建树

~~~cpp
//分层次遍历
void solve(){
    int n;
    cin >> n;
    map<int,int> insuf,inmid;
    vector<int> suf(n + 1),mid(n + 1);
    for(int i = 1;i <= n; ++i){
        cin >> suf[i];
        insuf[suf[i]] = i;
    }
    for(int i = 1;i <= n; ++i){
        cin >> mid[i];
        inmid[mid[i]] = i;
    }
    map<int,int> l,r;
    auto find = [&](int pl, int pr){
        int best = -INF;
        for(int i = pl;i <= pr; ++i){
            int val = mid[i];
            if(insuf[val] > best) best = insuf[val];
        }
        return suf[best];
    };
    auto built = [&](auto built, int pl, int pr)->int{
        if(pl > pr) return -1;
        int root = find(pl, pr);
        int pos = inmid[root];
        l[root] = built(built, pl, pos - 1);
        r[root] = built(built, pos + 1, pr);
        return root;
    };
    built(built, 1, n);
    int root = find(1, n);
    queue<int> q;
    q.push(root);
    vector<int> ans;
    while(q.size()){
        int cur = q.front();
        q.pop();
        ans.push_back(cur);
        if(l[cur] != -1) q.push(l[cur]);
        if(r[cur] != -1) q.push(r[cur]);
    }
    for(int i = 0;i < ans.size() - 1; ++i) cout << ans[i] << " ";
    cout << ans.back();
}
~~~

## 4.3	线段树

注意:懒标记会显著增加线段树时间复杂度，静态可以把懒标记删除

### 4.3.1	区间和线段树

~~~cpp
const int maxn = 100005;
i64 a[maxn], t[maxn << 2], lazy[maxn << 2];

// 1. 更新父节点：和 = 左儿子 + 右儿子
void Pushup(int k) {
    t[k] = t[k << 1] + t[k << 1 | 1];
}

void build(int k, int l, int r) {
    lazy[k] = 0;
    if (l == r) {
        t[k] = a[l];
        return;
    }
    int m = l + ((r - l) >> 1);
    build(k << 1, l, m);
    build(k << 1 | 1, m + 1, r);
    Pushup(k);
}

// 2. 懒标记下传：注意要乘以区间长度
void Pushdown(int k, int l, int r) {
    if (lazy[k] != 0) {
        int m = l + ((r - l) >> 1);
        
        // 下传给左儿子：加上的值 = 标记 * 左区间长度
        lazy[k << 1] += lazy[k];
        t[k << 1] += lazy[k] * (m - l + 1);
        
        // 下传给右儿子：加上的值 = 标记 * 右区间长度
        lazy[k << 1 | 1] += lazy[k];
        t[k << 1 | 1] += lazy[k] * (r - m);
        
        lazy[k] = 0;
    }
}

void update(int L, int R, i64 v, int l, int r, int k) {
    if (L <= l && r <= R) {
        lazy[k] += v;
        // 当前节点增加量 = v * 当前管辖的区间长度
        t[k] += v * (r - l + 1);
        return;
    }
    // 注意 Pushdown 现在需要知道当前的 l 和 r 来计算子区间长度
    Pushdown(k, l, r);
    int m = l + ((r - l) >> 1);
    if (L <= m) update(L, R, v, l, m, k << 1);
    if (R > m)  update(L, R, v, m + 1, r, k << 1 | 1);
    Pushup(k);
}

i64 query(int L, int R, int l, int r, int k) {
    if (L <= l && r <= R) {
        return t[k];
    }
    Pushdown(k, l, r);
    int m = l + ((r - l) >> 1);
    i64 res = 0; // 求和初始值为 0
    if (L <= m) res += query(L, R, l, m, k << 1);
    if (R > m)  res += query(L, R, m + 1, r, k << 1 | 1);
    return res;
}

void solve() {
    int n, q;
    if (!(cin >> n >> q)) return;
    for (int i = 1; i <= n; i++) cin >> a[i];
    build(1, 1, n);

    while (q--) {
        int op;
        cin >> op;
        if (op == 1) { // 区间加
            int x, y;
            i64 k;
            cin >> x >> y >> k;
            update(x, y, k, 1, n, 1);
        } else { // 区间求和
            int x, y;
            cin >> x >> y;
            cout << query(x, y, 1, n, 1) << "\n";
        }
    }
}
~~~

### 4.3.2	区间最大值线段树

~~~cpp
const int maxn = 100005;
i64 a[maxn], t[maxn << 2], lazy[maxn << 2];
// 更新父节点信息（当前是最大值 RMQ）
void Pushup(int k) {
    t[k] = max(t[k << 1], t[k << 1 | 1]);
}
// 递归建树：build(1, 1, n)
void build(int k, int l, int r) {
    lazy[k] = 0; // 习惯性初始化，防止多组数据干扰
    if (l == r) {
        t[k] = a[l];
        return;
    }
    int m = l + ((r - l) >> 1);
    build(k << 1, l, m);
    build(k << 1 | 1, m + 1, r);
    Pushup(k);
}
// 懒标记下传
void Pushdown(int k) {
    if (lazy[k] != 0) { // 如果有标记
        lazy[k << 1] += lazy[k];
        lazy[k << 1 | 1] += lazy[k];
        t[k << 1] += lazy[k];
        t[k << 1 | 1] += lazy[k];
        lazy[k] = 0; // 必须归零
    }
}
// 区间修改：update(L, R, v, 1, n, 1)
void update(int L, int R, i64 v, int l, int r, int k) {
    if (L <= l && r <= R) { // 当前节点被目标区间完全覆盖
        lazy[k] += v;
        t[k] += v;
        return;
    }
    Pushdown(k); // 只有不完全覆盖且需要继续往下走时才 pushdown
    int m = l + ((r - l) >> 1);
    if (L <= m) update(L, R, v, l, m, k << 1);
    if (R > m)  update(L, R, v, m + 1, r, k << 1 | 1);
    Pushup(k); // 回溯时更新
}

// 区间查询：query(L, R, 1, n, 1)
i64 query(int L, int R, int l, int r, int k) {
    if (L <= l && r <= R) {
        return t[k];
    }
    Pushdown(k);
    int m = l + ((r - l) >> 1);
    i64 res = -INF; 
    if (L <= m) res = max(res, query(L, R, l, m, k << 1));
    if (R > m)  res = max(res, query(L, R, m + 1, r, k << 1 | 1));
    return res;
}

void solve() {
    int n, q;
    if (!(cin >> n >> q)) return;
    for (int i = 1; i <= n; i++) cin >> a[i];

    build(1, 1, n);

    while (q--) {
        int opt;
        cin >> opt;
        if (opt == 1) { // 修改
            int L, R;
            i64 v;
            cin >> L >> R >> v;
            update(L, R, v, 1, n, 1);
        } else { // 查询
            int L, R;
            cin >> L >> R;
            cout << query(L, R, 1, n, 1) << "\n";
        }
    }
}
~~~

### 4.3.3	区间加乘和线段树

~~~cpp
const int maxn = 100005;
i64 a[maxn], t[maxn << 2];
i64 add[maxn << 2], mul[maxn << 2];
i64 n, m, p; // p 为模数，如果题目没要求模，可以去掉相关取模

void Pushup(int k) {
    t[k] = (t[k << 1] + t[k << 1 | 1]) % p;
}

void build(int k, int l, int r) {
    add[k] = 0;
    mul[k] = 1; // 乘法标记初始化为 1
    if (l == r) {
        t[k] = a[l] % p;
        return;
    }
    int mid = l + ((r - l) >> 1);
    build(k << 1, l, mid);
    build(k << 1 | 1, mid + 1, r);
    Pushup(k);
}

// 核心：下传函数
void push_eval(int k, int l, int r, i64 m_v, i64 a_v) {
    // 1. 更新当前节点的值：(值 * 乘) + (加 * 长度)
    t[k] = (t[k] * m_v % p + a_v * (r - l + 1) % p) % p;
    // 2. 更新乘法标记：旧乘 * 新乘
    mul[k] = mul[k] * m_v % p;
    // 3. 更新加法标记：(旧加 * 新乘) + 新加
    add[k] = (add[k] * m_v % p + a_v) % p;
}

void Pushdown(int k, int l, int r) {
    int mid = l + ((r - l) >> 1);
    // 把当前的 mul[k] 和 add[k] 传给左右儿子
    push_eval(k << 1, l, mid, mul[k], add[k]);
    push_eval(k << 1 | 1, mid + 1, r, mul[k], add[k]);
    // 标记归位
    mul[k] = 1;
    add[k] = 0;
}

// 区间乘法
void update_mul(int L, int R, i64 v, int l, int r, int k) {
    if (L <= l && r <= R) {
        push_eval(k, l, r, v, 0); // 加法增量为 0
        return;
    }
    Pushdown(k, l, r);
    int mid = l + ((r - l) >> 1);
    if (L <= mid) update_mul(L, R, v, l, mid, k << 1);
    if (R > mid)  update_mul(L, R, v, mid + 1, r, k << 1 | 1);
    Pushup(k);
}

// 区间加法
void update_add(int L, int R, i64 v, int l, int r, int k) {
    if (L <= l && r <= R) {
        push_eval(k, l, r, 1, v); // 乘法增量为 1
        return;
    }
    Pushdown(k, l, r);
    int mid = l + ((r - l) >> 1);
    if (L <= mid) update_add(L, R, v, l, mid, k << 1);
    if (R > mid)  update_add(L, R, v, mid + 1, r, k << 1 | 1);
    Pushup(k);
}

i64 query(int L, int R, int l, int r, int k) {
    if (L <= l && r <= R) return t[k];
    Pushdown(k, l, r);
    int mid = l + ((r - l) >> 1);
    i64 res = 0;
    if (L <= mid) res = (res + query(L, R, l, mid, k << 1)) % p;
    if (R > mid)  res = (res + query(L, R, mid + 1, r, k << 1 | 1)) % p;
    return res;
}
void solve() {
    // 这里的 p 建议设为一个大质数（如 1e9+7）或者题目要求的模数
    // 如果没有模数要求，把代码里所有的 % p 去掉即可
    cin >> n >> m >> p; 
    for (int i = 1; i <= n; i++) cin >> a[i];
    build(1, 1, n);

    while (m--) {
        int op, x, y;
        i64 k;
        cin >> op;
        if (op == 1) { // 乘法
            cin >> x >> y >> k;
            update_mul(x, y, k, 1, n, 1);
        } else if (op == 2) { // 加法
            cin >> x >> y >> k;
            update_add(x, y, k, 1, n, 1);
        } else { // 求和
            cin >> x >> y;
            cout << query(x, y, 1, n, 1) << "\n";
        }
    }
}
~~~



# 5	动态规划

## 5.1 最长不下降子序列 (LNDS)  

~~~cpp
int main() {
    int n;
    cin >> n;
    vector<int> a(n+1);
    for (int i = 1; i <= n; i++) cin >> a[i];
    vector<int> d;  // d[k]：长度 k+1 的 LNDS 的最小结尾
    // LNDS (不下降): 使用 upper_bound 找到第一个 > x 的位置替换
    // LIS (严格上升): 则改为 lower_bound 找到第一个 >= x 的位置替换
    for (int i = 1; i <= n; i++) {
        int x = a[i];
        auto it = upper_bound(d.begin()+1, d.end(), x);
        if (it == d.end()) {
            d.push_back(x);
        } else {
            *it = x;
        }
    }
    cout << d.size() << endl;
    return 0;
}
~~~

## 5.2	期望dp

~~~cpp
void solve(){
    int n,m;cin>>n>>m;
    vector<ld> dp(n+1,0);
    vector<vector<pair<int,int>>> e(n+1);
    for(int i = 1;i <= m; i++){
        int a,b,c;cin>>a>>b>>c;
        e[a].push_back({b,c});
    }
    auto dfs = [&](auto dfs,int u)->ld{
        if(u == n) return 0;
        if(dp[u]) return dp[u];
        for(auto [v,w]:e[u]){
            dp[u] += (dfs(dfs,v) + w)*1.0/e[u].size();
        }
        return dp[u];
    };
    dfs(dfs,1);
    cout<<fixed<<setprecision(2)<<dp[1];
}
~~~

## 5.3	LCS (最长公共子序列)  

~~~cpp
void solve() {
    string s, t;
    cin >> s >> t;

    int n = s.size();
    int m = t.size();

    // dp[i][j] 表示 s 的前 i 个字符与 t 的前 j 个字符的最长公共子序列长度
    // 这里的下标直接用 0 到 n，dp 大小开 (n+1) * (m+1)
    vector<vector<int>> dp(n + 1, vector<int>(m + 1, 0));

    // 1. 动态规划填表
    for (int i = 1; i <= n; i++) {
        for (int j = 1; j <= m; j++) {
            if (s[i - 1] == t[j - 1]) { // 注意字符串下标从 0 开始，所以是 i-1 和 j-1
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    // 2. 倒序回溯构造具体序列
    string ans = "";
    int i = n, j = m;
    while (i > 0 && j > 0) {
        if (s[i - 1] == t[j - 1]) {
            ans += s[i - 1]; // 发现公共字符
            i--;
            j--;
        } else {
            // 往 dp 值更大的方向回退
            if (dp[i - 1][j] >= dp[i][j - 1]) {
                i--;
            } else {
                j--;
            }
        }
    }

    // 因为是倒序回溯，最后需要反转字符串
    reverse(ans.begin(), ans.end());
    cout << ans << endl;
}
~~~

## 5.4	01背包

~~~cpp
void solve() {
    int n, v;
    cin >> n >> v;
    // dp: 只要容量不超过 j 的最大价值 (初始化为0)
    // dpp: 恰好容量为 j 的最大价值 (初始化为负无穷)
    vector<int> dp(v + 1, 0);
    vector<int> dpp(v + 1, -INF);

    dpp[0] = 0; // 恰好装满容量为 0 的价值是 0

    for (int i = 1; i <= n; i++) {
        int weight, value;
        cin >> weight >> value;
        
        // 0/1 背包逆序遍历，防止重复挑选同一个物品
        for (int j = v; j >= weight; j--) {
            // 变体1：不要求装满
            dp[j] = max(dp[j], dp[j - weight] + value);
            
            // 变体2：恰好装满 (只有当前驱状态可达时才转移)
            if (dpp[j - weight] != -INF) {
                dpp[j] = max(dpp[j], dpp[j - weight] + value);
            }
        }
    }

    // 输出 1：最大价值
    cout << dp[v] << "\n";

    // 输出 2：恰好装满的最大价值
    if (dpp[v] < 0) cout << 0 << "\n"; // 无法恰好装满
    else cout << dpp[v] << "\n";
}
~~~



# 6	杂项

## 6.1	单调栈

#### 核心思想

维护一个栈，使得栈内元素始终保持单调性：

- **单调递增栈**：从栈底到栈顶元素**递增**（栈顶最小）
- **单调递减栈**：从栈底到栈顶元素**递减**（栈顶最大）

#### 基本原理

##### 入栈规则（以单调递增栈为例）

1. 当栈为空，直接入栈
2. 当新元素 **>=** 栈顶元素，直接入栈（保持递增）
3. 当新元素 **<** 栈顶元素，**不断弹出栈顶**，直到满足递增条件，然后入栈

 **每当需要弹出时，就找到了栈顶元素右侧第一个比它小的元素（单调递增栈）**

#### 1.求左右最小

~~~cpp
void solve(){
    int n;
    cin >> n;
    vector<int> p(n + 1);
    for(int i = 1;i <= n; ++i) cin >> p[i];
    vector<int> st, l(n + 1, -1), r(n + 1, n + 1);
    for(int i = 1;i <= n; ++i){
        while(st.size() && p[st.back()] < p[i]){
            r[st.back()] = i;
            st.pop_back();
        }
        if(st.size()) l[i] = st.back();
        else l[i] = 0;
        st.push_back(i);
    }
}
~~~

2.

# 7	Trick

## 7.1	格式输出，防止多余空格

~~~cpp
cout << res << " \n"[j == n];
~~~

等价于

~~~cpp
if (j == n) {
    cout << res << "\n";   // 最后一个数后面换行
} else {
    cout << res << " ";    // 非最后一个数后面加空格
}
~~~

### 原理

`" \n"` 是一个字符串，长度为 3：

- 下标 0：`' '`（空格）
- 下标 1：`'\n'`（换行符）
- 下标 2：`'\0'`（字符串结束符）

`[j == n]` 是一个布尔表达式：

- 当 `j == n` 时，值为 `true`（在 C++ 中转换为整数 `1`）
- 当 `j != n` 时，值为 `false`（转换为整数 `0`）

所以：

- `j != n` → `" \n"[0]` → 输出**空格**
- `j == n` → `" \n"[1]` → 输出**换行符**



## 7.2	O(1)判断组合数奇偶性

$\binom{n}{m}$为奇数$\Leftrightarrow(m\& (n-m))=0$



## 7.3	去重

- **作用**：对容器进行去重（排序 + 去重）
- **公式**：`sort + unique + erase` 三件套
- **记忆**：`erase(unique(...), end())` 是固定搭配
- **适用**：vector、string、deque 等支持 `erase` 的容器
- **注意**：普通数组和 `array` 不能用 `erase`，只能记录新长度

1. **全局去重（所有重复只留一个）** → **需要排序**

~~~cpp
vector<int> v = {5, 2, 3, 2, 1, 5, 4};
// 需要排序
sort(v.begin(), v.end());
v.erase(unique(v.begin(), v.end()), v.end());
// 结果：{1, 2, 3, 4, 5}
~~~

2. **只去除连续重复** → **不需要排序**

~~~cpp
vector<int> v = {1, 1, 2, 2, 3, 1, 1, 4};
// 不需要排序
v.erase(unique(v.begin(), v.end()), v.end());
// 结果：{1, 2, 3, 1, 4}（只去掉相邻的）
~~~

## 7.4 对拍

gen.cpp

~~~cpp
#include<bits/stdc++.h>
using namespace std;
#define debug(x) cerr << #x << ": " << x << "\n";
using i64 = long long;
using i128 = __int128;
using ld = long double;
const i64 INF = 0x3f3f3f3f3f3f3f3f;
const i64 mod = 998244353;
mt19937_64 rng(chrono::steady_clock::now().time_since_epoch().count());

// ==================== 随机数工具箱 ====================

// 1. 生成 [l, r] 闭区间内的随机整数 (支持 long long)
i64 get_rand(i64 l, i64 r) {
    uniform_int_distribution<i64> dist(l, r);
    return dist(rng);
}

// 2. 生成随机小写字母
char get_rand_lowercase() {
    return (char)('a' + get_rand(0, 25));
}

// 3. 生成随机大写字母
char get_rand_uppercase() {
    return (char)('A' + get_rand(0, 25));
}

// 4. 生成一个长度为 n，元素在 [l, r] 之间的随机数组
vector<i64> get_rand_array(int n, i64 l, i64 r) {
    vector<i64> a(n);
    for (int i = 0; i < n; i++) {
        a[i] = get_rand(l, r);
    }
    return a;
}

// 5. 生成一个 1 到 n 的随机排列 (Permutation)
vector<int> get_rand_permutation(int n) {
    vector<int> p(n);
    iota(p.begin(), p.end(), 1); // 填充 1, 2, ..., n
    shuffle(p.begin(), p.end(), rng); // 随机打乱
    return p;
}

// ==================== 数据生成逻辑 ====================
void generate_data() {
    // 示例：生成一道常规题目的输入
    // 假设题目要求：第一行输入 n 和 k，第二行输入 n 个数的数组
    
    int n = get_rand(1, 1000); // 随机生成数据规模 n
    i64 k = get_rand(1, 1e9);  // 随机生成 k
    cout << n << " " << k << "\n";
    
    auto a = get_rand_array(n, 1, 1e9);
    for (int i = 0; i < n; i++) {
        cout << a[i] << (i == n - 1 ? "" : " ");
    }
    cout << "\n";
}

int main(){
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    
    // 默认生成 1 组测试数据
    generate_data();
    
    /*
    // 如果你要对拍的题目支持 T 组数据，可以解开这里的注释：
    int t = 5; // 每次对拍喂 5 组数据
    cout << t << "\n";
    while (t--) {
        generate_data();
    }
    */
    
    return 0;
}
~~~

duipai.cpp

~~~cpp
#include<bits/stdc++.h>
using namespace std;
using i64 = long long;
int main(){
    i64 cnt = 0;
    while(1){
        system("gen.exe > in.txt");
        system("std.exe < in.txt > std.txt");
        system("solve.exe < in.txt> my.txt");
        if(system("fc std.txt my.txt")) break;
        cout << "AC" << ++cnt << "\n";
    }
    cout << "WA" << "\n";
    return 0;
}
~~~


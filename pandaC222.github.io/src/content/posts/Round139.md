---
title: 牛客周赛139
published: 2026-04-13
description: 题解主要用于个人复盘
image: /assets/home/nkjs.webp
tags: [牛客周赛，算法]
category: 牛客周赛
---



比赛链接：https://ac.nowcoder.com/acm/contest/131539#question

# A. 小红的red 

模拟即可

~~~py
import sys
input = sys.stdin.readline
a = ['r','e','d']
s = input().strip()
for i in range(len(s)):
    if s[i] not in a:
        print("No")
        exit()
print("Yes")
~~~

# B. 小红的矩阵构造 

只有n = 1或者 m = 1才可以，n = 1横着放，m = 1 竖着放

~~~py
n, m = map(int,input().split())
if n == 1 and m >= 2:
    print("01",end='')
    for i in range(m - 2):
        print('1',end='')
elif n >= 2 and m == 1:
    print("0")
    print("1")
    for i in range(n - 2):
        print('1')
else:
    print(-1)
~~~

# C. 小红的数据结构 

我们维护一个队列一个栈，如果中途不成立就记录，最后根据成立情况判断

~~~cpp
#include<bits/stdc++.h>
using namespace std;
#define int long long
#define ld long double
#define debug(x) cerr << #x << ": " << x << '\n';
const int INF = 0x3f3f3f3f3f3f3f3f;

void solve(){
    int n, Q;cin >> n >> Q;
    vector<int> a(n + 1);
    for(int i = 1;i <= n; ++i) cin >> a[i];
    int cur = 1;
    queue<int> q;
    stack<int> st;
    bool okq = 1,okst = 1;
    while(Q--){
        int op;cin >> op;
        if(op == 1){
            int x;cin >> x;
            q.push(x);
            st.push(x);
        }
        else{
            int nq = q.front();q.pop();
            int nst = st.top();st.pop();
            if(nq != a[cur]) okq = 0;
            if(nst != a[cur]) okst = 0;
            cur++;
        }
    }
    if(okq && okst) cout << "both\n";
    else if(okq) cout << "queue\n";
    else if(okst) cout << "stack\n";
    else cout << "-1\n";
}
signed main(){
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(nullptr);
    int t = 1;
    // cin>>t;
    while(t--){
        solve();
    }return 0;
}
~~~

# D. 小红的部分相同字符串 

我们用并查集找出有几个依然还能改变的点，如果两个点相等就联通，我们用并查集刚好可以统计有几个连通块

~~~cpp
#include<bits/stdc++.h>
using namespace std;
#define int long long
const int INF = 0x3f3f3f3f3f3f3f3f;
const int mod = 998244353;
const int mx = 202020; 
int fac[mx+1],invfac[mx+1];
int fa[mx+1];
int find(int x){
    if(fa[x] == x) return x;
    return fa[x] = find(fa[x]);
}
void merge(int x,int y){
    int fx = find(x),fy = find(y);
    if(fx != fy){
        fa[fx] = fy;
    }
}
int fastpow(int x,int p){
    int ans = 1;
    while(p){
        if(p & 1) ans = ans * x % mod;
        x = x * x % mod;
        p >>= 1;
    }
    return ans % mod;
}
int inv(int x){
    return fastpow(x,mod - 2);
}
int c(int a,int b){
    if (b < 0 || b > a) return 0;
    return fac[a] * invfac[b] % mod * invfac[a-b] % mod;
}
void init(){
    fac[0] = 1;
    for(int i = 1;i <= mx; i++) fac[i] = fac[i-1] * i % mod;
    invfac[mx] = fastpow(fac[mx], mod - 2);
    for (int i = mx - 1; i >= 0; i--) invfac[i] = invfac[i + 1] * (i + 1) % mod;
    for(int i = 1;i < mx; i++) fa[i] = i;
}
void solve(){
    int n, k;cin >> n >> k;
    int cnt = 0;
    for(int i = 1;i <= k; ++i){
        int u, v; cin >> u >> v;
        merge(u,v);
    }
    for(int i = 1;i <= n; ++i){
        if(fa[i] == i) cnt++;
    }
    cout << fastpow(26,cnt) <<"\n";
}
signed main(){
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(nullptr);
    init();
    int t = 1;
    // cin>>t;
    while(t--){
        solve();
    }return 0;
}
~~~

# E. 小红的树权值 

详细见cf每日中没有上司的舞会

~~~cpp
#include<bits/stdc++.h>
using namespace std;
#define int long long
#define ld long double
#define debug(x) cerr << #x << ": " << x << '\n';
const int INF = 0x3f3f3f3f3f3f3f3f;

void solve(){
    int n;
    cin >> n;
    vector<vector<int>> e(n + 1);
    for(int i = 1;i <= n - 1; ++i){
        int u, v;
        cin >> u >> v;
        e[u].push_back(v);
        e[v].push_back(u);
    }
    vector<int> w(n + 1);
    vector<bool> vis(n + 1);
    auto dfs = [&](auto dfs,int u,int fa)->void{
        if(e[u].size() == 1 && u != 1){
            w[fa] = 1;
            vis[fa] = 1;
            w[u] = 0;
            return;
        }
        for(auto i : e[u]){
            if(i == fa) continue;
            dfs(dfs, i, u);
        }
        w[fa] = w[u] + (!vis[u]);
    };
    dfs(dfs, 1 , 0);
    for(int i = 1;i <= n; ++i){
        cout << w[i] << ' ';
    }
    cout<<"\n";
}
signed main(){
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(nullptr);
    int t = 1;
    cin>>t;
    while(t--){
        solve();
    }return 0;
}
~~~

# F. 小红的部分不同字符串 

基环树染色问题，对于不断不相等的点，我们最终可以连接成一个环，而且不可能只形成一条链，每个点一定会有一条边连接，我们用并查集维护这个环，环的染色公式是$$(q-1)^n + (-1)^n(q-1)$$，然后再乘上剩余的点即可

~~~cpp
#include<bits/stdc++.h>
using namespace std;
#define int long long
#define ld long double
#define debug(x) cerr << #x << ": " << x << '\n';
const int INF = 0x3f3f3f3f3f3f3f3f;
const int mod = 998244353;
const int N = 2e5 + 10;
int fa[N];
int fastpow(int x,int p){
    int ans = 1;
    while(p){
        if(p & 1) ans = ans * x % mod;
        x = x * x % mod;
        p >>= 1;
    }
    return ans % mod;
}
int find(int x){
    if(fa[x] == x) return x;
    return fa[x] = find(fa[x]);
}
void merge(int x,int y){
    int fx = find(x),fy = find(y);
    if(fx != fy){
        fa[fx] = fy;
    }
}
void init(){
    for(int i = 1;i < N; i++) fa[i] = i;
}
void solve(){
    int n;
    cin >> n;
    vector<int> a(n + 1);
    int ans = 1, cnt = 0;
    for(int i = 1;i <= n; ++i){
        cin >> a[i];
        if(find(i) == find(a[i])){
            int l = 1;
            int cur = a[i];
            while(cur != i){
                cur = a[cur];
                l++;
                if(cur == i) break;
            }
            cnt += l;
            if(l & 1) ans = ans * (fastpow(25, l) - 25 + mod) % mod;
            else ans = ans * (fastpow(25, l) + 25) % mod;
        }
        else merge(i, a[i]);
    }
    ans = ans * fastpow(25, n - cnt) % mod;
    cout << ans << "\n";
}
signed main(){
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(nullptr);
    init();
    int t = 1;
    // cin>>t;
    while(t--){
        solve();
    }return 0;
}
~~~


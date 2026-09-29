---
title: "牛客竞赛每日一题"
published: 2026-04-05T01:49:00+08:00
description: "如果不太难并且很有意义的题我就会更新（可能）"
image: "/assets/home/nowcoder.webp"
tags: ["算法", "每日一题"]
category: "牛客"
pinned: true
priority: 1
draft: false
---
每日一题链接：https://www.nowcoder.com/problem/tracker#/daily

# 	2026.4.4树上行走

知识点：并查集

我们有n个点，注意到，这n个点的权值只能是**0或者1**，进入一个点后，所有与该点不同类型的点都会消失（相连的边也会消失），所以我们要求的就是相同点最大的连通块，在这些连通块中，我们可以选择任意一个点来进入，并查集刚好适用于这道题来寻找连通块，对于一条边权值相同的两个点，我们对其边合并边维护连通块最大值即可，最后遍历如果这个节点的父节点的连通块的大小等于最大值，这个点就可以放入ans数组中。

merge时将size小的往size大的上面合并有利于降低树高。
merge时顺便把max_size记录下来，可省去遍历。
ans本来就是从小到大的，不需要重排序。 

代码如下（cpp）：

~~~cpp
#include<bits/stdc++.h>
#include <vector>
using namespace std;
#define int long long
#define ld long double
#define debug(x) cerr << #x << ": " << x << '\n';
const int INF = 0x3f3f3f3f3f3f3f3f;
const int N = 2e5+10;
int fa[N],sz[N];
int mx;
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
            mx = max(sz[fx],mx);
        }
        else{
            fa[fx] = fy;
            sz[fy] += sz[fx];
            mx = max(sz[fy],mx);
        }
    }
}
void solve(){
    init();
    int n;cin>>n;
    vector<int> a(n+1);
    for(int i = 1;i <= n; i ++) cin>>a[i];
    for(int i = 1;i <= n-1; i ++){
        int u,v;cin>>u>>v;
        if(a[u] == a[v]){
            merge(u,v);
        }
    }
    
    vector<int> ans;
    for(int i = 1; i <=n ; i ++){
        if(sz[find(i)] == mx) ans.push_back(i);
    }
    cout<<ans.size()<<"\n";
    for(auto i : ans) cout<<i<<" ";
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



# 2026.4.6 **小苯的麦克斯** 

知识点：mex

mex: **最小未出现非负整数**

我们需要求选择一个连续区间最大的max-mex值，这个区间最小长度为2，我们由mex的定义知对于一个区间只有0，1，2，3，4这种连续的数才能使mex不短增大，如果区间最小值为1，那mex就是0了，因此我们很容易得到取两个区间时可以使mex最小，因此我们可以在max两边取区间，同时考虑边界情况，如果max=min的情况得特判，如果max=min=0，输出-1;如果最大值为0，也输出-1，其他情况正常判断就行

这样判断写起来好像比较麻烦，其实可以每次取两个区间求它们的max-mex同时用ans维护最大值即可，这样写起来比较简短，我只给出第一种解法

代码如下（py）：

~~~python
import sys
input = sys.stdin.readline
t = int(input())
for _ in range(t):
    n = int(input())
    a = list(map(int,input().split()))
    mx = max(a)
    mn = min(a)
    ans = 0
    if mx == 0:
        print(-1)
        continue
    if mx == 1:
        if mn == 1:
            print(1)
        else:
            print(-1)
        continue
    if a[0] == mx:
        if a[1] == 0:
            ans = max(mx - 1, ans)
        else:
            ans = max(mx, ans)
    if a[-1] == mx:
        if a[-2] == 0:
            ans = max(mx - 1, ans)
        else:
            ans = max(mx, ans)
    for i in range(1,n-1):
        if a[i] == mx:
            mn = min(a[i+1], a[i-1])
            if mn == 0:
                ans = max(mx - 1, ans)
            else:
                ans = max(mx, ans)
    print(ans)
~~~



# 2026.4.7 **计算一年中的第几天** 

水题

我们判断是否使闰年，闰年(Y % 4 == 0 && Y % 100 != 0 || Y % 400 == 0)2月天数为29天

代码如下（cpp）：

~~~cpp
#include <bits/stdc++.h>
using namespace std;
int m[13] = {0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
int main() {
    int Y, M, D, d;
    while (cin>>Y>>M>>D) {
        d = D;
        for (int i = 0; i < M; i++) d += m[i];
        if (Y % 4 == 0 && Y % 100 != 0 || Y % 400 == 0) d += 1;
        cout<<d<<"\n";
    }
    return 0;
}
~~~

# 2026.4.8抽卡

题目链接：https://www.nowcoder.com/practice/cddfb87d552c468d9176e95efffa7b3c?channelPut=tracker2

知识点：概率，快速幂，逆元，费马小定理

题目问如果每个卡池里都单抽一次，能抽到自己想要的卡的概率是多少 ，我们通过推断发现直接算能抽到的概率不好算，因为你直接相乘能抽到的概率相当于取交集，因此我们通过算每个卡池抽不到的概率p相乘，P=（1-p1）*（1-p2）....（1-pn），最终答案就是（1-P），但是我们需要mod1e9+7，由于概率可能是个分数，在处理分数模运算，我们需要求逆元，mod是质数，可以根据费马小定理求得逆元，inv(x) = fastpow(x,mod-2)。

代码如下（cpp）：

~~~cpp
#include<bits/stdc++.h>
using namespace std;
#define int long long
#define ld long double
#define debug(x) cerr << #x << ": " << x << '\n';
const int INF = 0x3f3f3f3f3f3f3f3f;
const int mod = 1e9 + 7;
int fastpow(int x, int p){
    int ans = 1;
    x %= mod;
    while(p){
        if(p&1) ans = ans * x % mod;
        p >>= 1;
        x = x * x % mod;
    }
    return ans;
}
int inv(int x){
    return fastpow(x, mod - 2);
}
void solve(){
    int n;cin>>n;
    int fenzi = 1, fenmu = 1;
    vector<int> a(n+1),b(n+1);
    for(int i = 1;i <= n; i++) cin>>a[i],fenmu = fenmu * a[i] % mod;
    for(int i = 1;i <= n; i++){
        cin>>b[i];
        fenzi = fenzi * (a[i] - b[i]) % mod;
    }
    if(fenzi == 0) cout<<1;
    else cout<<(1 - fenzi * inv(fenmu) % mod + mod) % mod;
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



# 2026.4.9绿豆蛙的归宿

知识点：动态规划

 本题是一道期望dp模板题，正解是动态规划或者记忆化搜索，但是由于牛客数据较弱，正常写不记忆化搜索的dfs也放过去了，这种写法在洛谷中(题目同名)是会T的。 

 注意到，我们需要求从起点1到N**路径总长度的期望值，**我们正常dfs写法，就是从每次从起点dfs到N，记录路径长度len，记录出边数的乘积sz，使用全概率公式求得这条路径的期望长度res，加到总期望ans中，我们给出这种直接dfs的代码：

~~~cpp
#include<bits/stdc++.h>
using namespace std;
#define int long long
#define ld long double
#define debug(x) cerr << #x << ": " << x << '\n';
const int INF = 0x3f3f3f3f3f3f3f3f;

void solve(){
    int n,m;cin>>n>>m;
    vector<vector<pair<int,int>>> e(n+1);
    for(int i = 1;i <= m; i++){
        int a,b,c;cin>>a>>b>>c;
        e[a].push_back({b,c});
    }
    ld ans = 0;
    auto dfs = [&](auto dfs,int u,int l,int sz)->void{
        if(u == n){
            ans += l*1.0/sz;
            return;
        }
        for(auto [v,w]:e[u]){
            dfs(dfs,v,l+w,sz*e[u].size());
        }
    };
    dfs(dfs,1,0,1);
    cout<<fixed<<setprecision(2)<<ans;
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

 在牛客中这种写法是可以过的，但是在洛谷中会T两个样例，原因是这种暴力的写法在边数非常大时每次重新dfs一次走过的点，复杂度会爆发式增长。 

 ![img](https://uploadfiles.nowcoder.com/images/20260409/272812068_1775734246035/D2B5CA33BD970F64A6301FA75AE2EB22) 

因此我们可以想到用一个数组f[n]每次记录走过的点的期望，这样再次走这个点u时直接返回f[u],这样的话我们每个点只会遍历1次，每条边也遍历一次，因此复杂度就会来到O(n+m)，这就是记忆化搜索优化时间复杂度，这样我们就可以通过这道题了。

这是一个从后往前的过程，因为我们dfs在走到终点时才往回返回记录f[u]的值，答案就是f[1]，注意到，我们到底已经终点u==n后期望值为0，因为我们已经到底了，直接返回0就行。

便于理解，这里给出样例递归搜索树：

 ![img](https://uploadfiles.nowcoder.com/images/20260409/272812068_1775734595349/D2B5CA33BD970F64A6301FA75AE2EB22) 

 接下来我们给出记忆化搜索写法的代码： 

~~~cpp
#include<bits/stdc++.h>
using namespace std;
#define int long long
#define ld long double
#define debug(x) cerr << #x << ": " << x << '\n';
const int INF = 0x3f3f3f3f3f3f3f3f;

void solve(){
    int n,m;cin>>n>>m;
    vector<ld> f(n+1,-1);
    vector<vector<pair<int,int>>> e(n+1);
    for(int i = 1;i <= m; i++){
        int a,b,c;cin>>a>>b>>c;
        e[a].push_back({b,c});
    }
    auto dfs = [&](auto dfs,int u)->ld{
        if(u == n) return 0;
        if(f[u] != -1) return f[u];
        ld res = 0;
        for(auto [v,w]:e[u]){
            res += (dfs(dfs,v) + w)*1.0/e[u].size();
        }
        return f[u] = res;
    };
    dfs(dfs,1);
    cout<<fixed<<setprecision(2)<<f[1];
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

 当然，记忆化搜索和dp本质相同，我们通过简单改写就是dp写法了 

 代码如下： 

~~~cpp
#include<bits/stdc++.h>
using namespace std;
#define int long long
#define ld long double
#define debug(x) cerr << #x << ": " << x << '\n';
const int INF = 0x3f3f3f3f3f3f3f3f;

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

# 2026.4.10 **小红的图上加边**

知识点：贪心，并查集

我们先用并查集将已经连接的边合并起来，并且更新这个区间的最大值，然后我们再遍历一遍n个节点，将每个连通块的代表节点(fa[i]==i)加入到remain数组中，接下来我们只需要把这些代表点连接起来即可，由于连接的代价是新形成的联通块的最大元素值 ，我们需要最小代价，我们可以贪心想到对这些点的最大元素值从小到大排序，从头连到尾，这样代价就是除去第一个点代价的总代价。

~~~cpp
#include<bits/stdc++.h>
using namespace std;
#define int long long
#define ld long double
#define debug(x) cerr << #x << ": " << x << '\n';
const int INF = 0x3f3f3f3f3f3f3f3f;
const int N = 1e5 + 10;
int fa[N],w[N];
int find(int x){
    if(fa[x] == x) return x;
    return fa[x] = find(fa[x]);
}
void merge(int x,int y){
    int fx = find(x),fy = find(y);
    if(fx != fy){
        fa[fx] = fy;
        w[fy] = max(w[fy],w[fx]);
    }
}
void init(){
    for(int i = 1;i < N; i++) fa[i] = i;
}
void solve(){
    int n,m;cin>>n>>m;
    for(int i = 1;i <= n; i++){
        int x;cin>>w[i];
    }
    int cur = -1;
    for(int i = 1;i <= m; i++){
        int u,v;cin>>u>>v;
        merge(u,v);
    }
    int ans = 0;
    vector<int> remain;
    for(int i = 1;i <= n; i++){
        if(fa[i] == i) remain.push_back(w[i]);
    }
    sort(remain.begin(),remain.end());
    for(int i = 1;i < remain.size(); i++) ans += remain[i];
    cout<<ans;
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

# 2026.4.12 **小红背单词** 

知识点：哈希，模拟

我们用两个map分别记录这个单词是否已经背会和背的次数即可

~~~cpp
#include<bits/stdc++.h>
using namespace std;
#define int long long
#define ld long double
#define debug(x) cerr << #x << ": " << x << '\n';
const int INF = 0x3f3f3f3f3f3f3f3f;

void solve(){
    int n;cin >> n;
    int ans = 0;
    map<string,int> ok;
    map<string,int> cnt;
    for(int i = 1;i <= n; ++i){
        string s;cin >> s;
        cnt[s]++;
        if(!ok.count(s) and cnt[s] > ans){
            ans++;
            ok[s] = 1;
        }
    }
    cout<<ans<<"\n";
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

# 2026.4.13 **元素方碑** 

水题

我们观察可以发现1，3，5，7这种隔一个元素的位置可以互相转移，只能分为1，3，5和2，4，6这两种，我们直接判断是否相等即可

~~~cpp
#include<bits/stdc++.h>
using namespace std;
#define int long long
#define debug(x) cerr << #x << ": " << x << '\n';
const int INF = 0x3f3f3f3f3f3f3f3f;
void solve(){
    int n;
    cin >> n;
    int sum1 = 0, sum2 = 0;
    for(int i = 1;i <= n; ++i){
        int x;
        cin >> x;
        if(i & 1LL) sum1 += x;
        else sum2 += x;
    }
    if(n == 1){
        cout<<"YES\n";
        return;
    }
    if(sum1 % ((n+1)/2) == 0 && sum2 % (n/2) == 0 && sum1 / ((n+1)/2) == sum2 / (n/2)){
        cout<<"YES\n";
    }
    else cout<<"NO\n";
}
signed main(){
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(nullptr);
    int t = 1;
    cin >> t;
    while(t--){
        solve();
    }return 0;
}
~~~

# 2026.4.14 **小美的01串翻转** 

知识点：dp，暴力

这道题给出两种写法，一种是dp，一种是暴力，时间复杂度都是O(n^2)

dp写法，我们枚举每个元素作为起点，内层循环到终点，这样就是所有子串了，我们对于当前元素s[i]与前一个元素s[i - 1]对比，如果s[i] == s[i - 1],可以选择换s[i - 1]或者换s[i],如果s[i] != s[i - 1],那么可以选择不换或者都换,这就是状态转移方程

代码如下：

~~~cpp
#include<bits/stdc++.h>
#include <vector>
using namespace std;
#define int long long
#define debug(x) cerr << #x << ": " << x << '\n';
const int INF = 0x3f3f3f3f3f3f3f3f;
void solve(){
    string s;
    cin >> s;
    int len = s.size();
    s = ' ' + s;
    int ans = 0;
    vector<vector<int>> dp(len + 1,vector<int>(2));
    for(int i = 1;i <= len; ++i){
        dp[i][0] = 0, dp[i][1] = 1;
        for(int j = i + 1;j <= len; ++j){
            if(s[j] == s[j - 1]){
                dp[j][0] = dp[j - 1][1];
                dp[j][1] = dp[j - 1][0] + 1;
            }
            else{
                dp[j][0] = dp[j - 1][0];
                dp[j][1] = dp[j - 1][1] + 1;
            }
            ans += min(dp[j][0], dp[j][1]);
        }
    }
    cout << ans << '\n';
}
signed main(){
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(nullptr);
    int t = 1;
    // cin >> t;
    while(t--){
        solve();
    }return 0;
}
~~~

暴力我们可以想到，对于最终结果只有1010101或者01010101这两种情况，我们只需要预处理一个前缀和数组，记录数组变成第一种情况的权值，第二种情况的权值就是这个子串长度减去第一种情况的权值，两种情况取最小即可

~~~cpp
#include<bits/stdc++.h>
using namespace std;
#define int long long
#define debug(x) cerr << #x << ": " << x << '\n';
const int INF = 0x3f3f3f3f3f3f3f3f;
void solve(){
    string s;
    cin >> s;
    int len = s.size();
    s = ' ' + s;
    vector<int> cost(len + 1);
    //101010101
    //010101010
    int ans = 0;
    for(int i = 1;i <= len; ++i){
        if(i & 1){
            if(s[i] != '1') cost[i] = cost[i - 1] + 1;
            else cost[i] = cost[i - 1];
        }
        else{
            if(s[i] != '0') cost[i] = cost[i - 1] + 1;
            else cost[i] = cost[i - 1];
        }
    }
    for(int i = 1;i <= len; ++i){
        for(int j = 1;j <= i; ++j){
            int c1 = cost[i] - cost[j - 1];
            int c2 = i - j + 1 - c1;
            ans += min(c1, c2);
        }
    }
    cout << ans << "\n";
}
signed main(){
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(nullptr);
    int t = 1;
    // cin >> t;
    while(t--){
        solve();
    }return 0;
}
~~~

# 4.16 **小红树上染色** 

知识点：树形dp

我们可以知道，如果一个节点为白色，那他的父节点一定得是红色，如果一个节点是红色，那他的父节点可以是白色或者红色

这可以推出状态转移方程了，我们从根部向上转移：（0代表白色，1代表红色）

dp[u][0] = (dp[u][0] * dp[v][1]) % mod; 父节点为白色子节点只能为红色

dp[u][1] = (dp[u][1] * (dp[v][0] + dp[v][1])) % mod; 父节点为红色子节点可以为白色或者红色

注意到，我们在计算这种方案时需要用到乘法，因为每种方案都是独立的，所以我们需要将每个节点的dp[u][0]和dp[u][1]初始化为1

代码如下(cpp):

~~~cpp
#include<bits/stdc++.h>
using namespace std;
#define int long long
#define debug(x) cerr << #x << ": " << x << '\n';
const int INF = 0x3f3f3f3f3f3f3f3f;
const int mod = 1e9 + 7;
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
    vector<vector<int>> dp(n+1,vector<int>(2));
    auto dfs = [&](auto dfs, int u, int fa)->void{
        dp[u][0] = 1;
        dp[u][1] = 1;
        for(auto v : e[u]){
            if(v == fa) continue;
            dfs(dfs, v, u);
            dp[u][0] = (dp[u][0] * dp[v][1]) % mod;
            dp[u][1] = (dp[u][1] * (dp[v][0] + dp[v][1])) % mod;
        }
    };
    dfs(dfs, 1, 0);
    cout << (dp[1][0] + dp[1][1]) % mod;
}
signed main(){
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(nullptr);
    int t = 1;
    // cin >> t;
    while(t--){
        solve();
    }return 0;
}
~~~

# 2026.4.19 **小红的完全二叉树构造** 

其实这道题很简单，我们通过手推可以发现，先放偶数是完全可以解决这个构造问题的

代码如下：

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
    for(int i = 1;i <= n; ++i){
        if(i % 2 == 0) cout << i << " ";
    }
    for(int i = 1;i <= n; ++i){
        if(i & 1) cout << i << " ";
    }
}
signed main(){
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(nullptr);
    int t = 1;
    // cin >> t;
    while(t--){
        solve();
    }return 0;
}
~~~

# 2026.4.20 **穷哈哈~** 

简单的转移

~~~cpp
#include<bits/stdc++.h>
#include <vector>
using namespace std;
#define int long long
#define ld long double
#define debug(x) cerr << #x << ": " << x << '\n';
const int INF = 0x3f3f3f3f3f3f3f3f;

void solve(){
    int n;
    string s;
    cin >> n >> s;
    vector<int> dp(n + 1, 0);
    s = ' ' + s;
    for(int i = 1;i <= n; ++i){
        if(s[i] == 'a' || s[i] == 'h') dp[i] = 1;
    }
    int ans = dp[1];
    for(int i = 2;i <= n; ++i){
        if(s[i] == 'h' && s[i - 1] == 'a'){
            dp[i] += dp[i - 1];
        }
        if(i >= 3 && (s[i] == 'a' && s[i - 1] == 'h' && s[i - 2] == 'a')){
            dp[i] += dp[i - 1];
        }
        ans = max(ans, dp[i]);
    }
    cout << ans;
}
signed main(){
    ios_base::sync_with_stdio(false);
    cin.tie(0);
    int t = 1;
    // cin >> t;
    while(t--) solve();
    return 0;
}
~~~

# 2026.4.21 dd爱框框 

双指针

~~~cpp
#include<bits/stdc++.h>
using namespace std;
#define int long long
#define ld long double
#define debug(x) cerr << #x << ": " << x << '\n';
const int INF = 0x3f3f3f3f3f3f3f3f;

void solve(){
    int n, x;
    cin >> n >> x;
    vector<int> a(n + 1);
    for(int i = 1;i <= n; ++i) cin >> a[i];
    int l = 1;
    int sum = 0;
    int ansl = -INF, ansr = INF;
    for(int r = 1;r <= n; ++r){
        sum += a[r];
        while(sum >= x){
            if(r - l < ansr - ansl){
                ansl = l, ansr = r;
            }
            sum -= a[l];
            l++;
        }
    }
    cout << ansl << " " << ansr;
}
signed main(){
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(nullptr);
    int t = 1;
    // cin >> t;
    while(t--){
        solve();
    }return 0;
}
~~~


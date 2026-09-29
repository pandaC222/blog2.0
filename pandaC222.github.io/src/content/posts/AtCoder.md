---
title: AtCoder Beginner Contest 453复盘
published: 2026-04-12
description: A-E
image: /assets/home/atc.webp
tags: [AtCoder,算法]
category: 算法
---

比赛链接：https://atcoder.jp/contests/abc453

主要用于个人复盘

# A - Trimo

语法题，我们找出第一个不是o的索引输出切片即可

~~~py
n = int(input())
s = input()
if s.count('o') == n:
    print()
else:
    idx = 0
    for i in range(n):
        if s[i] != 'o':
            idx = i
            break
    print(s[idx:])
~~~

#  **B - Sensor Data Logging** 

模拟题，我们按照题目模拟即可

~~~py
t,x = map(int,input().split())
a = list(map(int,input().split()))
ans = []
for i in range(t+1):
    if i == 0:
        ans.append((i,a[i]))
    elif abs(a[i] - ans[-1][1]) >= x:
        ans.append((i,a[i]))
for i in range(len(ans)):
    print(f"{ans[i][0]} {ans[i][1]}")
~~~

#  **C - Sneaking Glances** 

数据N最大只有20，我们通过枚举所有数选与不选的情况即可，这里用dfs实现

~~~py
import sys
input = sys.stdin.readline
n = int(input())
a = list(map(int,input().split()))
ans = 0
def dfs(step,sum,cur):
    global ans
    if sum + n - step <= ans:
        return
    if step == n:
        ans = max(ans,sum)
        return
    dfs(step + 1,sum + (cur > 0 and cur - a[step] < 0),cur - a[step])
    dfs(step + 1,sum + (cur < 0 and cur + a[step] > 0),cur + a[step])
dfs(0,0,0.5)
print(ans)
~~~

#  **D - Go Straight** 

与我们平时搜索题不同，这是一道带状态的bfs，我们要记录每次移动的方向，遇到o只能跟前一次方向不同，遇到x不能与前一次方向不同，遇到#不能进入，注意这几个特判，我们然后用前驱数组pre[nx] [ny] [d],记录进入nx，ny的方向d，紧接着最后逆推即可

~~~cpp
#include<bits/stdc++.h>
using namespace std;
#define int long long
#define ld long double
#define debug(x) cerr << #x << ": " << x << '\n';
const int INF = 0x3f3f3f3f3f3f3f3f;
int dx[] = {0,1,0,-1};
int dy[] = {-1,0,1,0};
char dc[] = {'L','D','R','U'};
struct node{
    int r,c,d;
};
//udlr
bool vis[1005][1005][4];
node pre[1005][1005][4];
void solve(){
    int h,w;cin>>h>>w;
    pair<int,int> b,e;
    vector<vector<char>> pos(h+1,vector<char>(w+1));
    for(int i = 1;i <= h; ++i){
        string s;cin>>s;
        for(int j = 1;j <= w; ++j){
            pos[i][j] = s[j-1];
            if(pos[i][j] == 'S') b.first = i,b.second = j;
            if(pos[i][j] == 'G') e.first = i,e.second = j;
        }
    }
    queue<node> q;
    q.push({b.first,b.second,-1});
    int end = -1;
    while(q.size()){
        auto [x,y,d] = q.front();q.pop();
        if(x == e.first && y == e.second){
            end = d;
            break;
        }
        for(int i = 0;i < 4; ++i){
            int nx = x + dx[i],ny = y + dy[i];
            if(nx < 1 || ny < 1 || nx > h || ny > w || vis[nx][ny][i] || pos[nx][ny] == '#') continue;
            if(d != -1){
                if(pos[x][y] == 'x' && i == d) continue;
                if(pos[x][y] == 'o' && i != d) continue;
            }
            pre[nx][ny][i] = {x,y,d};
            vis[nx][ny][i] = 1;
            q.push({nx,ny,i});
        }
    }
    if(end == -1){
        cout<<"No";
    }
    else{
        cout<<"Yes\n";
        string ans;
        node cur = {e.first,e.second,end};
        while(cur.d != -1){
            ans += dc[cur.d];
            cur = pre[cur.r][cur.c][cur.d];
        }
        reverse(ans.begin(),ans.end());
        for(auto i : ans) cout<<i;
    }
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

#  **E - Team Division** 

这是一道组合数加容斥原理加差分处理题

我们从1~n-1枚举a队人数，对能达到的情况求和，在这里我们要记录的就是当前必须进入a和当前必须进入b，以及他们的交集既能进入a又能进入b，我们根据容斥原理，如果cura+curb-curboth=n时，a队员数为i才成立，才可以计算，这种情况就是从both中选缺的a的人，缺的a的人qa=i - (n-curb),由组合数c(both,qa)计算累加即可

~~~cpp
#include<bits/stdc++.h>
using namespace std;
#define int long long
const int INF = 0x3f3f3f3f3f3f3f3f;
const int mod = 998244353;
const int mx = 1e6+1000; 
int fac[mx+1],invfac[mx+1];
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
}
//n-r,n-l
void solve(){
    int n;cin>>n;
    vector<int> diffa(n+5),diffb(n+5),diffboth(n+5);
    for(int i = 1;i <= n; ++i){
        int l,r;cin>>l>>r;
        diffa[l]++;
        diffa[r+1]--;
        diffb[n-r]++;
        diffb[n-l+1]--;
        int mn = min(n - l ,r);
        int mx = max(l,n-r);
        if(mn < mx) continue;
        diffboth[mn+1]--;
        diffboth[mx]++;
    }
    int cura = 0,curb = 0,curboth = 0,ans = 0;
    for(int i = 1;i <= n - 1; ++i){
        cura += diffa[i];
        curb += diffb[i];
        curboth += diffboth[i];
        if(cura + curb - curboth == n){
            int ma = n - curb;
            int ned = i - ma;
            ans = (ans + c(curboth,ned)) % mod;
        }
    }
    cout<<ans<<"\n";
}
signed main(){
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(nullptr);
    int t = 1;
    init();
    // cin>>t;
    while(t--){
        solve();
    }return 0;
}
~~~


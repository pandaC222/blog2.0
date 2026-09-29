---
title: "Codeforces Round 1090 (Div.4)题解"
published: 2026-04-05
description: "G只写了代码"
image: /assets/home/codeforce.webp
tags: ["算法","Codeforces"]
category: "Codeforces"

---

比赛链接：https://codeforces.com/contest/2218

每道题都会给出py和cpp两个版本

cpp版本是我赛时写的

###  A. The 67th Integer Problem 

我们只需要输出67即可



py

~~~python
t = int(input())
for _ in range(t):
    print(67)
~~~





cpp

~~~cpp
#include<bits/stdc++.h>
using namespace std;
#define int long long
#define ld long double
#define debug(x) cerr << #x << ": " << x << '\n';
const int INF = 0x3f3f3f3f3f3f3f3f;
const int N=1e9;
void solve(){
    int x;cin>>x;
    cout<<67<<"\n";
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



###  B. The 67th 6-7 Integer Problem 

我们只需要先对数组排序再依次取前6个数的相反数即可




py

~~~python
t = int(input())
for _ in range(t):
    a = list(map(int,input().split()))
    a.sort()
    ans = 0
    for i in range(6):
        ans -= a[i]
    print(ans + a[-1])
~~~





cpp

~~~cpp
#include<bits/stdc++.h>
using namespace std;
#define int long long
#define ld long double
#define debug(x) cerr << #x << ": " << x << '\n';
const int INF = 0x3f3f3f3f3f3f3f3f;

void solve(){
    vector<int> a(8);
    for(int i=1;i<=7;i++) cin>>a[i];
    sort(a.begin()+1,a.end());
    int sum=0;
    for(int i=1;i<=6;i++) sum-=a[i];
    cout<<sum+a[7]<<"\n"; 
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



###  C. The 67th Permutation Problem 

一道简单的构造题，通过观察不难发现，我们只需要把从小到大连续的两个大数放到一块，第三个数放从1开始的小数，这样可以取到最大，例如6 5 1 4 3 2


py

~~~python
t = int(input())
for _ in range(t):
    n = int(input())
    cur = 1
    mx = n*3
    for i in range(n):
        print(f"{mx} {mx-1} {cur}",end=" ")
        cur += 1
        mx -= 2
    print()
~~~





cpp

~~~cpp
#include<bits/stdc++.h>
using namespace std;
#define int long long
#define ld long double
#define debug(x) cerr << #x << ": " << x << '\n';
const int INF = 0x3f3f3f3f3f3f3f3f;

void solve(){
    int n;cin>>n;
    int cur=1,mx=n*3;
    for(int i=1;i<=n;i++){
        cout<<mx<<" "<<mx-1<<" "<<cur<<" ";
        mx-=2;
        cur++;
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



###  D. The 67th OEIS Problem 

本题的上限为1e18，经过观察，可行的方式为筛选出前1e4个质数，前一个质数和后一个质数相乘即可

第10001个质数大约是104729，不会超出上限。




py

~~~python
import sys
input = sys.stdin.readline
N = 200010
heshu = [False] * N
zhishu = []
def sieve():
    for i in range(2,N):
        if not heshu[i]:
            zhishu.append(i)
            if i * i < N:
                for j in range(i * i, N , i):
                    heshu[j] = True
sieve()
t = int(input())
for _ in range(t):
    ans = []
    n = int(input())
    for i in range(n):
        ans.append(zhishu[i]*zhishu[i+1])
    print(*ans)
~~~





cpp

~~~cpp
#include<bits/stdc++.h>
using namespace std;
typedef long long ll;
const int N=1e7+10;
int zhishu[N];
int heshu[N];
int cnt;
void solve(){
    ll n;cin>>n;
    for(int i=1;i<=n;i++) cout<<(ll)zhishu[i]*zhishu[i+1]<<" ";
}
int main(){
    for(ll i=2;i<=N;i++){
        if(!heshu[i]){
            cnt++;
            zhishu[cnt]=i;
            for(ll j=i*i;j<=N;j+=i){
                heshu[j]=1;
            }
        }
    }
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(nullptr);
    int t = 1;
    cin>>t;
    while(t--){
        solve();
    }return 0;
}
//Onloglogn
~~~



###  E. The 67th XOR Problem 

首先知道a ^ a = 0 ,0 ^ a = a,我们根据题意模拟两个样例，会发现，在不断异或的情况下，前n-2个数会抵消，最后只剩下两个数异或，所以答案为数组中两个数异或最大值，时间复杂度为O(n*n),对于本题完全足够




py

~~~python
import sys
input = sys.stdin.readline
t = int(input())
for _ in range(t):
    n = int(input())
    a = list(map(int,input().split()))
    ans = 0
    for i in range(n):
        for j in range(i+1,n):
            ans = max(ans,a[i]^a[j])
    print(ans)
~~~





cpp

~~~cpp
#include<bits/stdc++.h>
using namespace std;
#define int long long
#define ld long double
#define debug(x) cerr << #x << ": " << x << '\n';
const int INF = 0x3f3f3f3f3f3f3f3f;

void solve(){
    int n;cin>>n;
    vector<int> a(n+1);
    for(int i=1;i<=n;i++) cin>>a[i];
    int ans=0;
    for(int i=1;i<=n;i++){
        for(int j=i+1;j<=n;j++){
            ans=max(ans,a[i]^a[j]);
        }
    }
    cout<<ans<<"\n";
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



###  F. The 67th Tree Problem 

本题是一道构造题，我们通过观察，最简单的构造方式就是只挂一个点或者两个点，首先根节点会贡献一个奇数或者偶数节点，这个由总数x+y决定，先减去这个贡献，单个点与根节点相连，会贡献一个奇数节点，两个点与根结构相连会贡献一个奇数节点和一个偶数节点，所以偶数<=奇数节点，并且减去根贡献后，奇数偶数节点数需要大于0，不满足则输出NO，满足按以上方式构造即可




py

~~~python
import sys
input = sys.stdin.readline
t = int(input())
for _ in range(t):
    x,y = map(int,input().split())
    sum = x + y
    if sum&1:
        y -= 1
    else:
        x -= 1
    if x < 0 or y < 0 or x > y:
        print("NO")
        continue
    print("YES")
    cur = 2
    for i in range(x):
        print(f"{1} {cur}")
        print(f"{cur} {cur+1}")
        cur += 2
    while cur <= sum:
        print(f"{1} {cur}")
        cur += 1
~~~





cpp

~~~cpp
#include<bits/stdc++.h>
using namespace std;
#define int long long
#define ld long double
#define debug(x) cerr << #x << ": " << x << '\n';
const int INF = 0x3f3f3f3f3f3f3f3f;

void solve(){
    int x,y;cin>>x>>y;
    int sum=x+y;
    if((x+y)&1) y--;
    else x--;
    if(x<0||y<0||x>y){
        cout<<"NO\n";
        return;
    }
    int cur=2;
    cout<<"YES\n";
    for(int i=1;i<=x;i++){
        cout<<1<<" "<<cur<<"\n";
        cout<<cur<<" "<<cur+1<<"\n";
        cur+=2;
    }
    
    while(cur<=sum){
        cout<<1<<" "<<cur<<"\n";
        cur++;
    }
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



###  G. The 67th Iteration of "Counting is Fun" 

预处理前缀和

cpp

~~~cpp
#include <bits/stdc++.h>
using namespace std;

#define int long long
#define ld long double
#define debug(x) cerr << #x << ": " << x << '\n';

const int INF = 0x3f3f3f3f3f3f3f3f;
const int mod = 676767677;

void solve() {
    int n, m;
    cin>>n>>m;

    vector<int> b(n + 2, INF);
    vector<int> c(n + 1, 0);
    for (int i = 1; i <= n; i++) {
        cin >> b[i];
        c[b[i]]++;
    }

    vector<int> s(n + 1, 0);
    s[0] = c[0];
    for (int i = 1; i <= n; i++) {
        s[i] = s[i - 1] + c[i];
    }

    int ans = 1;
    for (int i = 1; i <= n; i++) {
        if (b[i] == 0) continue;

        int mn = min(b[i - 1], b[i + 1]);
        if (mn >= b[i]) {
            cout << 0 << "\n";
            return;
        }

        if (mn == b[i] - 1) {
            ans = (ans * s[b[i] - 1]) % mod;
        } else {
            ans = (ans * (s[b[i] - 1] - s[b[i] - 2])) % mod;
        }
    }
    cout << (ans + mod) % mod << "\n";
}

signed main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int t = 1;
    cin >> t;
    while (t--) {
        solve();
    }
    return 0;
}
~~~


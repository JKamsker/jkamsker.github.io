---
layout: post
title: "Polyfill C#: Two Ways to Ship One Library Across Two Frameworks"
summary: Two strategies for supporting multiple .NET target frameworks — compiled conditionals and partial classes with file exclusion.
author: jkamsker
date: '2025-10-05 12:00:00 +0000'
category: guides
thumbnail: /assets/img/posts/code.jpg
keywords: csharp, dotnet, multi-targeting, polyfill, netstandard, net8, partial-classes
tags: [csharp, dotnet]
permalink: /blog/polyfill-csharp/
---

> **TL;DR:** You're multi-targeting a library across `netstandard2.0` and `net8.0`. Different APIs are available on each. You need the same public surface but different guts. Strategy 1: `#if` directives. Works, but scales like a dumpster fire. Strategy 2: partial classes with file exclusion in the `.csproj`. Cleaner, saner, and your future self won't file a grievance.

## The Situation

You have a library. It targets two frameworks — say, `netstandard2.0` (because the world is full of legacy projects that aren't going anywhere) and `net8.0` (because you'd like to use APIs invented after 2017). Both targets need to expose the same public interface, but the *implementation* has to differ because the available APIs are completely different.

This is a solved problem. It's solved in two ways. One of them is good.

## Strategy 1: `#if` Directives (The "It's Fine" Approach)

The classic. The familiar. The thing you reach for first and regret third.

```csharp
#if NET8_0
    // net8 specific code — spans, modern goodness, joy
#else
    // netstandard specific code — string allocations, suffering
#endif
```

For a single method with a two-line difference? Perfectly fine. For an entire class where half the methods have different implementations, different helper types, and different using statements? You end up with a file that looks like a ransom note assembled from two different codebases. The syntax highlighting turns into abstract art. Code review becomes a puzzle game where the goal is figuring out which lines actually compile on which target.

It works. It always works. It just stops being *pleasant* somewhere around the fourth nested `#if`.

## Strategy 2: Partial Classes + File Exclusion (The Grown-Up Approach)

This is the one. Split each class into three files: the shared surface, the .NET Core implementation, and the .NET Standard implementation. Then tell MSBuild which files belong to which target.

The `.csproj`:

```xml
<PropertyGroup>
  <TargetFrameworks>netstandard2.0;net8.0</TargetFrameworks>
</PropertyGroup>

<ItemGroup Condition="'$(TargetFramework)' == 'netstandard2.0'">
  <Compile Remove="**\*.NetCore.cs" />
  <None Remove="**\*.NetCore.cs" />
</ItemGroup>

<ItemGroup Condition="'$(TargetFramework)' == 'net8.0'">
  <Compile Remove="**\*.NetStd.cs" />
  <None Remove="**\*.NetStd.cs" />
</ItemGroup>
```

The shared interface — `MyClass.cs`:

```csharp
public partial class MyClass
{
    public partial void CommonMethod();
}
```

The .NET 8 implementation — `MyClass.NetCore.cs`:

```csharp
public partial class MyClass
{
    public partial void CommonMethod()
    {
        // The good implementation. Spans. Performance. Happiness.
    }
}
```

The .NET Standard fallback — `MyClass.NetStd.cs`:

```csharp
public partial class MyClass
{
    public partial void CommonMethod()
    {
        // The "it works and that's enough" implementation.
    }
}
```

When building for `net8.0`, MSBuild excludes the `*.NetStd.cs` files entirely. When building for `netstandard2.0`, the `*.NetCore.cs` files disappear. Each target only sees the files it's supposed to. No `#if` spaghetti. No guessing which code path is active. Just clean, separate files that each do one thing for one target.

## Which One Should You Use?

Honestly? Start with `#if`. If the conditional block is small and isolated, it's the right call — introducing three files for a two-line difference is overkill.

The moment you catch yourself scrolling past a wall of preprocessor directives trying to find where the `netstandard` path ends and the `net8` path begins, switch to Strategy 2. Your code reviewers will thank you. Your IDE will thank you. The next person to touch this file — who is statistically likely to be you, three months from now, with no memory of why any of this exists — will thank you.

```
Approach Comparison:

  #if directives:    Quick to write. Painful to maintain. O(n²) regret scaling.
  Partial + exclude: More files. More setup. Zero ambiguity about what runs where.
```

Pick your pain. I pick the one with fewer `#endif`s.
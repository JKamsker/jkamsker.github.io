---
layout: post
title: "Polyfill C#"
summary: Two strategies for supporting multiple .NET target frameworks — compiled conditionals and partial classes with file exclusion.
author: jkamsker
date: '2025-10-05 12:00:00 +0000'
category: guides
thumbnail: /assets/img/posts/code.jpg
keywords: csharp, dotnet, multi-targeting, polyfill, netstandard, net8, partial-classes
tags: [csharp, dotnet]
permalink: /blog/polyfill-csharp/
---

Imagine we have the following.
- Library supports 2 target frameworks: Eg netstandard and net8
- Make both work and as fast as possible
- Different apis available


## Strategy 1: Compiled statements

```csharp
#if NET8_0
    // net8 specific code
#else
    // netstandard specific code
#endif
```

This can work but it can definetely blow up in complexity.

## Strategy 2: Partial classes + file exclusion

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

Usage:

``MyClass.cs``

```csharp
public partial class MyClass
{
    public partial void CommonMethod();
}
```

``MyClass.NetCore.cs``
```csharp
public partial class MyClass
{
    public partial void CommonMethod()
    {
        // Implementation for netstandard
    }
}
```

``MyClass.NetStd.cs``
```csharp
public partial class MyClass
{
    public partial void CommonMethod()
    {
        // Implementation for net8
    }
}
```

---
title: Writing a fitness tracker app in Flutter (Day 1)
description: Activity Recognition
tags: blog fitness-tracker flutter
author: Remtori
---

# Writing a fitness tracker app in Flutter (Day 1)

This is a second "serious" mobile application project that i and my friend have a chance to work on.
The first one not  really meet our satisfaction so this time we decided to be even more "serious".

**Motivate people to walk** *with some fancy looking mobile application* is the basic requirement of this app.

## Trello

First, we need something to keep everything else in check. We choose [Trello][trello]. Really cool web app, hope i can make something like that in the future.

With all the task `marked down` next is to do the research, a lot of research actually.
You see, this is our first time using [Flutter][flutter], after reading through some document about [Flutter][flutter] and [Dart][dart], understanding the basic concept of [Flutter][flutter] as well as[Dart][dart] language syntax, its time for looking into how to get some necessary data from the user.

## Activity Recognition

We need a way to check if the user is walking, so after some time consulting `Google-sama`, we got some idea of how to do this.

You see both Android and IOS has an API for checking the user current activity. Mean while [Flutter][flutter] has a outdated package that hook everything up.

How do i know its outdated? Well it didn't compile and the fact that it hasn't been updated in 13 months doesn't help either. I can try and fix that and make it compile somehow, but the last time i did it i fell into a dependencies hell with all the package incompatible with each other and shared library version difference from package to package.

Luckily, the package this time is kinda small and the native API is really straight forward (that what i think at the time after reading some document about the API), i decided that it would be a good idea to make the bridge between [Dart][dart] and native myself.

```
Me: ...
Me: Where the hell am i suppose to get a "context"?
Me: ..
Me: AND WHAT THE F IS AN INTENT?
Me: ..
Me: WHY THE F MY CALLBACK NOT BEING CALL.
Me: Isn't that what its suppose to do? You know, getting CALL BACK
```

Okay, it not really a smooth sail is it. By the way the answer for those "rant" is:

- In the MainActivity (the thing that extend FlutterActivity) scope, a context is `this` or you can call `getContext`

- An Intent ... i still didn't really know what an intent is, but you need to create a new class that extends something, in my case `IntentService` then you can do
```java
new Intent(this, SomeThingExtendsIntentService.class);
```

- The `SomeThingExtendsIntentService.class` need to be place in `AndroidManifest.xml` with a service tag like:
```xml
<service android:name="com.example.app.SomeThingExtendsIntentService" />
```

After a while of testing, everything work as *intended* and i go to sleep early for the day.
*Or is it?*

[trello]: https://trello.com
[flutter]: https://flutter.dev/
[dart]: https://dart.dev/

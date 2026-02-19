---
layout: default
title: Categories
permalink: /blog/categories/
summary: "Browse all blog categories and find posts by topic."
---

<div class="blog-page">
  <div class="blog-page__header">
    <div>
      <span class="blog-page__label">Browse</span>
      <h1 class="blog-page__title">All Categories</h1>
    </div>
    <a class="blog-page__back" href="{{ '/blog' | relative_url }}">
      <i class="fa fa-arrow-left"></i> All Articles
    </a>
  </div>

  {% for category in site.categories %}
  {% capture category_name %}{{ category | first }}{% endcapture %}
  <div class="category-section">
    <div class="category-section__header">
      <a href="{{ site.baseurl }}/blog/categories/{{ category_name }}" class="category-section__name">
        {{ category_name }}
        <span class="category-section__count">{{ category[1].size }}</span>
      </a>
    </div>
    <div class="blog-page__list">
      {% for post in site.categories[category_name] %}
      <a href="{{ site.baseurl }}{{ post.url }}" class="blog-card" style="animation-delay: {{ forloop.index0 | times: 0.06 }}s">
        {% if post.thumbnail %}
        <div class="blog-card__thumb">
          <img src="{{ post.thumbnail | relative_url }}" alt="{{ post.title }}" loading="lazy" />
        </div>
        {% endif %}
        <div class="blog-card__body">
          <div class="blog-card__meta">
            <time class="blog-card__date" datetime="{{ post.date }}">{{ post.date | date: "%b %-d, %Y" }}</time>
          </div>
          <h2 class="blog-card__title">{{ post.title }}</h2>
          {% if post.summary %}
          <p class="blog-card__summary">{{ post.summary | truncate: 120 }}</p>
          {% endif %}
          <div class="blog-card__footer">
            {% if post.tags.size > 0 %}
            <div class="blog-card__tags">
              {% for tag in post.tags limit:3 %}
              <span class="blog-card__tag">#{{ tag }}</span>
              {% endfor %}
            </div>
            {% endif %}
            <span class="blog-card__read-more">Read <i class="fa fa-arrow-right"></i></span>
          </div>
        </div>
      </a>
      {% endfor %}
    </div>
  </div>
  {% endfor %}
</div>

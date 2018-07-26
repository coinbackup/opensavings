import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CheckBalanceComponent } from './check-balance.component';

describe('CheckBalanceComponent', () => {
  let component: CheckBalanceComponent;
  let fixture: ComponentFixture<CheckBalanceComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CheckBalanceComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CheckBalanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

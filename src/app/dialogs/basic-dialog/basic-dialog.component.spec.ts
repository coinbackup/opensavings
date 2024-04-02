import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { BasicDialog } from './basic-dialog.component';

describe('BasicDialog', () => {
  let component: BasicDialog;
  let fixture: ComponentFixture<BasicDialog>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ BasicDialog ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(BasicDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
